-- 05_perf_indexes.sql
-- Purpose: Additional indexes to improve live RPC performance.

-- Trigram index to accelerate ILIKE on enrollment_code
CREATE INDEX IF NOT EXISTS ix_student_enrollments_code_trgm
  ON student_enrollments USING GIN (enrollment_code gin_trgm_ops);

-- Composite index to match window ordering (effective_date, created_at)
CREATE INDEX IF NOT EXISTS ix_student_progressions_enrollment_eff_created_desc
  ON student_progressions(enrollment_id, effective_date DESC, created_at DESC);

-- Composite filter index when both course and session are filtered
CREATE INDEX IF NOT EXISTS ix_student_enrollments_course_session
  ON student_enrollments(course_id, session_id);

-- Partial index matching last payment lookup predicate
CREATE INDEX IF NOT EXISTS ix_fee_receipts_recent_active
  ON fee_receipts(enrollment_id, receipt_date DESC)
  WHERE deleted_at IS NULL AND status = 'ACTIVE';
