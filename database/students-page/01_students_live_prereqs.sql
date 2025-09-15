-- 01_students_live_prereqs.sql
-- Purpose: Prereqs and indexes for real-time Students grid using base tables/views.
-- Safe to run multiple times.

-- Enable trigram for fast ILIKE search on names
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Name search on students
CREATE INDEX IF NOT EXISTS ix_students_full_name_trgm ON students USING GIN (full_name gin_trgm_ops);

-- Enrollment filters
CREATE INDEX IF NOT EXISTS ix_student_enrollments_session ON student_enrollments(session_id);
CREATE INDEX IF NOT EXISTS ix_student_enrollments_course ON student_enrollments(course_id);
CREATE INDEX IF NOT EXISTS ix_student_enrollments_code ON student_enrollments(enrollment_code);

-- Progression latest pick
CREATE INDEX IF NOT EXISTS ix_student_progressions_enrollment_effdate_desc ON student_progressions(enrollment_id, effective_date DESC);

-- Course by college filter
CREATE INDEX IF NOT EXISTS ix_courses_college_id ON courses(college_id);

-- Helpful for last payment lookup
CREATE INDEX IF NOT EXISTS ix_fee_receipts_enrollment_date ON fee_receipts(enrollment_id, receipt_date DESC);

-- Optional: speed up fee summary view source (already covered in 006)
-- CREATE INDEX IF NOT EXISTS ix_fee_ledger_events_enrollment_year ON fee_ledger_events(enrollment_id, academic_year);
