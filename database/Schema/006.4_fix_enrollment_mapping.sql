-- Fix enrollment_id mapping in fee_current_balances table
-- This updates the enrollment_id to use actual enrollment IDs from student_enrollments table

-- First, let's see what we have
SELECT 
    fcb.id,
    fcb.enrollment_id as current_enrollment_id,
    fcb.legacy_student_id,
    se.id as correct_enrollment_id,
    se.student_id
FROM fee_current_balances fcb
LEFT JOIN student_enrollments se ON fcb.legacy_student_id = se.legacy_student_id
WHERE se.id IS NOT NULL
LIMIT 10;

-- Update the enrollment_id to use the correct enrollment ID
UPDATE fee_current_balances 
SET enrollment_id = se.id
FROM student_enrollments se
WHERE fee_current_balances.legacy_student_id = se.legacy_student_id
  AND se.id IS NOT NULL;

-- Check how many records were updated
SELECT COUNT(*) as updated_records
FROM fee_current_balances fcb
JOIN student_enrollments se ON fcb.enrollment_id = se.id;

-- Now add back the foreign key constraints
ALTER TABLE fee_current_balances 
ADD CONSTRAINT fk_fee_current_balances_fee_component 
FOREIGN KEY (fee_component_id) REFERENCES fee_components(id);

ALTER TABLE fee_current_balances 
ADD CONSTRAINT fk_fee_current_balances_enrollment 
FOREIGN KEY (enrollment_id) REFERENCES student_enrollments(id);
