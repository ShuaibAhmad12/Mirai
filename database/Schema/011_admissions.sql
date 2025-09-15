-- Purpose: Issue a new enrollment in one transaction (no staging table)
-- Atomically: reserve next colleges.admission_number, compute code, create/reuse student, create enrollment, set student's current_enrollment_id
-- Security: leverage RBAC helper if present; fee seeding (if any) can be added later
CREATE OR REPLACE FUNCTION fn_issue_enrollment(
  p_applicant_name text,
  p_college_id uuid,
  p_course_id uuid,
  p_session_id uuid,
  p_agent_id uuid DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_entry_type text DEFAULT 'regular', -- 'regular'|'lateral'
  p_joining_date date DEFAULT NULL
)
RETURNS TABLE(enrollment_id uuid, enrollment_code text, student_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user uuid := auth.uid();
  v_session record;
  v_college record;
  v_next_number int;
  v_first_year int;
  v_student_id uuid;
  v_enrollment_id uuid;
  v_enrollment_code text;
  v_college_code text;
BEGIN
  -- permission check (falls back to TRUE if stub returns authenticated)
  IF NOT user_has_permission(v_auth_user, 'ADMISSIONS', 'CREATE') THEN
    RAISE EXCEPTION 'Insufficient permissions to confirm admissions';
  END IF;
  
  -- load session and college
  SELECT * INTO v_session FROM academic_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found: %', p_session_id; END IF;
  SELECT * INTO v_college FROM colleges WHERE id = p_college_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'College not found: %', p_college_id; END IF;
  v_college_code := v_college.code;

  -- compute first year of session
  v_first_year := COALESCE(date_part('year', v_session.start_date)::int,
                           NULLIF(split_part(v_session.title, '-', 1), '')::int);
  IF v_first_year IS NULL THEN
    v_first_year := date_part('year', current_date)::int;
  END IF;

  -- atomically reserve and get issued number (pre-increment value)
  UPDATE colleges
  SET admission_number = admission_number + 1
  WHERE id = p_college_id
  RETURNING admission_number - 1 INTO v_next_number;

  IF v_next_number IS NULL THEN
    RAISE EXCEPTION 'Failed to reserve admission number for college %', p_college_id;
  END IF;

  -- build enrollment code: college_code/admission_number/firstYear
  v_enrollment_code := COALESCE(NULLIF(trim(v_college_code), ''), 'COL') || '/' || v_next_number::text || '/' || v_first_year::text;

  -- create or reuse student
  IF p_student_id IS NOT NULL THEN
    v_student_id := p_student_id;
  ELSE
    INSERT INTO students (full_name, status, created_at, updated_at, updated_by)
    VALUES (p_applicant_name, 'active', now(), now(), v_auth_user)
    RETURNING id INTO v_student_id;
  END IF;

  -- create enrollment
  INSERT INTO student_enrollments (
    student_id, course_id, session_id, enrollment_code, enrollment_date, joining_date,
    entry_year, entry_type, agent_id, fee_plan_id, status, created_at, updated_at, updated_by
  ) VALUES (
    v_student_id, p_course_id, p_session_id, v_enrollment_code, current_date, p_joining_date,
    v_first_year::smallint, p_entry_type, p_agent_id, NULL, 'active', now(), now(), v_auth_user
  ) RETURNING id INTO v_enrollment_id;

  -- set current enrollment on student
  UPDATE students SET current_enrollment_id = v_enrollment_id, updated_at = now(), updated_by = v_auth_user
  WHERE id = v_student_id;

  -- return
  enrollment_id := v_enrollment_id;
  enrollment_code := v_enrollment_code;
  student_id := v_student_id;
  RETURN NEXT;
  RETURN;
END;
$$;
