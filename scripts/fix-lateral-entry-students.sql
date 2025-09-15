-- Fix existing lateral entry students by creating progression records
-- This should be run once to fix students created before the lateral entry logic was implemented

INSERT INTO student_progressions (
  enrollment_id,
  from_year,
  to_year,
  effective_date,
  status,
  notes,
  created_at,
  updated_at
)
SELECT 
  e.id as enrollment_id,
  NULL as from_year,
  2 as to_year,
  COALESCE(e.joining_date, e.enrollment_date) as effective_date,
  'new_admission' as status,
  'Lateral entry admission - starting in year 2 (retroactively fixed)' as notes,
  NOW() as created_at,
  NOW() as updated_at
FROM student_enrollments e
LEFT JOIN student_progressions p ON p.enrollment_id = e.id
WHERE 
  e.entry_type = 'lateral' 
  AND p.id IS NULL  -- Only create for students who don't already have progression records
  AND e.status = 'active';

-- Verify the fix
SELECT 
  s.full_name,
  e.enrollment_code,
  e.entry_type,
  p.to_year as current_year,
  p.status,
  p.notes
FROM student_enrollments e
JOIN students s ON s.id = e.student_id
LEFT JOIN student_progressions p ON p.enrollment_id = e.id
WHERE e.entry_type = 'lateral'
ORDER BY e.created_at DESC;
