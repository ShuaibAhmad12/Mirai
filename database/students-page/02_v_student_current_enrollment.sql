-- 02_v_student_current_enrollment.sql
-- Purpose: Resolve a student's current enrollment with safe fallback.
-- Postgres-compatible; live (no materialization).

CREATE OR REPLACE VIEW v_student_current_enrollment AS
WITH preferred AS (
  SELECT 
    s.id AS student_id,
    se.id AS enrollment_id,
    se.enrollment_code,
    se.session_id,
    se.course_id,
    se.status,
    se.entry_year,
    1 AS priority
  FROM students s
  LEFT JOIN student_enrollments se ON se.id = s.current_enrollment_id
  WHERE s.current_enrollment_id IS NOT NULL
), fallback AS (
  SELECT 
    s.id AS student_id,
    se.id AS enrollment_id,
    se.enrollment_code,
    se.session_id,
    se.course_id,
    se.status,
    se.entry_year,
    2 AS priority,
    ROW_NUMBER() OVER (
      PARTITION BY s.id 
      ORDER BY se.enrollment_date DESC NULLS LAST, se.created_at DESC NULLS LAST
    ) AS rn
  FROM students s
  JOIN student_enrollments se ON se.student_id = s.id AND se.status = 'active'
)
SELECT student_id, enrollment_id, enrollment_code, session_id, course_id, status, entry_year
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY priority ASC) AS pick
  FROM (
    SELECT student_id, enrollment_id, enrollment_code, session_id, course_id, status, entry_year, priority FROM preferred
    UNION ALL
    SELECT student_id, enrollment_id, enrollment_code, session_id, course_id, status, entry_year, priority FROM fallback WHERE rn = 1
  ) u
) ranked
WHERE pick = 1;

COMMENT ON VIEW v_student_current_enrollment IS 'Current enrollment for each student (uses students.current_enrollment_id or latest active)';
