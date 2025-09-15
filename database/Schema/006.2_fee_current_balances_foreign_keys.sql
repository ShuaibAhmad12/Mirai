-- Add foreign key relationships for fee_current_balances table
-- This allows Supabase to understand the relationships for joins

-- Add foreign key to fee_components table
ALTER TABLE fee_current_balances 
ADD CONSTRAINT fk_fee_current_balances_fee_component 
FOREIGN KEY (fee_component_id) REFERENCES fee_components(id);

-- Add foreign key to student_enrollments table
ALTER TABLE fee_current_balances 
ADD CONSTRAINT fk_fee_current_balances_enrollment 
FOREIGN KEY (enrollment_id) REFERENCES student_enrollments(id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fee_current_balances_fee_component_id 
ON fee_current_balances(fee_component_id);

CREATE INDEX IF NOT EXISTS idx_fee_current_balances_enrollment_id 
ON fee_current_balances(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_fee_current_balances_academic_year 
ON fee_current_balances(academic_year);

CREATE INDEX IF NOT EXISTS idx_fee_current_balances_year_number 
ON fee_current_balances(year_number);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_fee_current_balances_enrollment_year 
ON fee_current_balances(enrollment_id, academic_year, year_number);
