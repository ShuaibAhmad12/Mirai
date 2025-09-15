-- 03_rpc_students_grid_live.sql
-- Purpose: Live Students grid RPC (real-time) joining base tables + fee view.

CREATE OR REPLACE FUNCTION rpc_students_grid_live(
  p_q text DEFAULT NULL,
  p_college_id uuid DEFAULT NULL,
  p_course_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_current_year int DEFAULT NULL,
  p_sort text DEFAULT 'full_name',
  p_order text DEFAULT 'asc',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
) RETURNS TABLE (
  student_id uuid,
  full_name text,
  enrollment_id uuid,
  enrollment_code text,
  father_name text,
  mother_name text,
  session_id uuid,
  session_title text,
  current_year int,
  course_id uuid,
  course_name text,
  course_duration int,
  college_id uuid,
  college_name text,
  college_code text,
  previous_balance numeric,
  current_due numeric,
  total_outstanding numeric,
  last_payment_date date,
  last_payment_amount numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH ce AS (
    SELECT * FROM v_student_current_enrollment
  ), sp AS (
    SELECT enrollment_id, to_year, course_duration
    FROM (
      SELECT 
        enrollment_id,
        to_year,
        course_duration,
        ROW_NUMBER() OVER (PARTITION BY enrollment_id ORDER BY effective_date DESC NULLS LAST, created_at DESC NULLS LAST) AS rn
      FROM student_progressions
    ) t WHERE rn = 1
  ), j AS (
    SELECT 
      s.id AS student_id,
      s.full_name,
      s.status AS student_status,
      p.father_name,
      p.mother_name,
      ce.enrollment_id,
      ce.enrollment_code,
      ce.status AS enrollment_status,
      ce.session_id,
      se.title AS session_title,
      ce.course_id,
      c.name AS course_name,
      COALESCE(c.duration, sp.course_duration) AS course_duration,
      c.college_id,
  col.name AS college_name,
  col.code AS college_code,
      COALESCE(sp.to_year, ce.entry_year, 1) AS current_year
    FROM ce
    JOIN students s ON s.id = ce.student_id
    LEFT JOIN student_profiles p ON p.student_id = s.id
    LEFT JOIN academic_sessions se ON se.id = ce.session_id
    LEFT JOIN courses c ON c.id = ce.course_id
    LEFT JOIN colleges col ON col.id = c.college_id
    LEFT JOIN sp ON sp.enrollment_id = ce.enrollment_id
    WHERE (p_q IS NULL OR s.full_name ILIKE '%' || p_q || '%' OR ce.enrollment_code ILIKE '%' || p_q || '%')
      AND (p_college_id IS NULL OR c.college_id = p_college_id)
      AND (p_course_id IS NULL OR c.id = p_course_id)
      AND (p_session_id IS NULL OR ce.session_id = p_session_id)
      AND (p_current_year IS NULL OR COALESCE(sp.to_year, ce.entry_year, 1) = p_current_year)
  )
  SELECT 
    j.student_id,
    j.full_name,
    j.enrollment_id,
    j.enrollment_code,
    j.father_name,
    j.mother_name,
    j.session_id,
    j.session_title,
    j.current_year,
    j.course_id,
    j.course_name,
    j.course_duration,
  j.college_id,
  j.college_name,
  j.college_code,
  COALESCE(fy.prev_balance, 0)::numeric(12,2) AS previous_balance,
  COALESCE(fy.current_due, 0)::numeric(12,2) AS current_due,
  (COALESCE(fy.prev_balance, 0) + COALESCE(fy.current_due, 0))::numeric(12,2) AS total_outstanding,
    lp.last_payment_date,
    lp.last_payment_amount
  FROM j
  LEFT JOIN LATERAL (
    SELECT 
      v.outstanding_balance AS current_due,
      (COALESCE(SUM(v.outstanding_balance) OVER (), 0) - COALESCE(v.outstanding_balance, 0)) AS prev_balance
    FROM view_fee_year_summary v
    WHERE v.enrollment_id = j.enrollment_id
    ORDER BY v.last_activity DESC NULLS LAST, v.academic_year DESC
    LIMIT 1
  ) fy ON true
  LEFT JOIN LATERAL (
    SELECT r.receipt_date AS last_payment_date, r.paid_amount AS last_payment_amount
    FROM fee_receipts r
    WHERE r.enrollment_id = j.enrollment_id AND r.deleted_at IS NULL AND r.status = 'ACTIVE'
    ORDER BY r.receipt_date DESC, r.created_at DESC
    LIMIT 1
  ) lp ON true
  ORDER BY 
    CASE WHEN p_sort = 'full_name' AND p_order = 'asc' THEN j.full_name END ASC,
    CASE WHEN p_sort = 'full_name' AND p_order = 'desc' THEN j.full_name END DESC,
    CASE WHEN p_sort = 'total_outstanding' AND p_order = 'asc' THEN (COALESCE(fy.prev_balance, 0) + COALESCE(fy.current_due, 0)) END ASC,
    CASE WHEN p_sort = 'total_outstanding' AND p_order = 'desc' THEN (COALESCE(fy.prev_balance, 0) + COALESCE(fy.current_due, 0)) END DESC,
    CASE WHEN p_sort = 'current_due' AND p_order = 'asc' THEN COALESCE(fy.current_due, 0) END ASC,
    CASE WHEN p_sort = 'current_due' AND p_order = 'desc' THEN COALESCE(fy.current_due, 0) END DESC,
    j.full_name ASC, j.enrollment_id ASC
  LIMIT p_limit OFFSET p_offset;
$$;

COMMENT ON FUNCTION rpc_students_grid_live IS 'Live Students grid from base tables/views for real-time freshness';
