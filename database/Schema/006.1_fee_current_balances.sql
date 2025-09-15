-- 006.1_fee_current_balances.sql
-- Current Fee Balances System (Scalable Live Balance Tracking)
-- Author: Alpine Education System
-- Purpose: Live balance tracking with legacy mapping for fee balance migration

-- Depends on: 006_fee_ledger_system.sql, 003_feestable.sql
-- Note: This extends the fee ledger system with current balance tracking

-- ============================================================================
-- CURRENT FEE BALANCES TABLE (LIVE BALANCE TRACKING)
-- ============================================================================

-- Current fee balances (live balances for fast lookups) - SIMPLIFIED FOR IMPORT
CREATE TABLE fee_current_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Student and academic context
    enrollment_id UUID NOT NULL,
    academic_year TEXT,
    
    -- Fee component details
    fee_component_id UUID,
    
    -- Denormalized component info for performance
    component_code TEXT, -- From fee_components.code
    component_name TEXT, -- From fee_components.name
    year_number INTEGER,
    
    -- Financial amounts
    original_amount NUMERIC(12,2) DEFAULT 0, -- From fee plan
    override_amount NUMERIC(12,2) DEFAULT 0, -- From student overrides
    discount_amount NUMERIC(12,2) DEFAULT 0, -- Applied discounts
    charged_amount NUMERIC(12,2) DEFAULT 0,  -- What student owes (override - discount)
    paid_amount NUMERIC(12,2) DEFAULT 0,     -- Total payments received
    outstanding_amount NUMERIC(12,2) DEFAULT 0, -- Current balance (charged - paid)
    
    -- Audit and metadata
    last_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Legacy data correlation (CRITICAL for migration mapping)
    legacy_student_id INTEGER, -- Maps to alpine_fees_feebalance.student_id
    legacy_balance_id TEXT,    -- Maps to alpine_fees_feebalance.id (if available)
    legacy_course_id INTEGER,  -- Maps to alpine_fees_feebalance.course_id
    legacy_session_id INTEGER, -- Maps to alpine_fees_feebalance.session_id
    legacy_component_name TEXT, -- Original component name from legacy system
    
    -- Source tracking for reconciliation
    source_system TEXT DEFAULT 'manual',
    import_batch_id UUID, -- Links to import batch for tracking
    migration_notes TEXT,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
    
    -- CONSTRAINTS TEMPORARILY REMOVED FOR IMPORT
    -- We'll add them back after data cleanup
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE (SIMPLIFIED FOR IMPORT)
-- ============================================================================

-- Basic indexes for essential lookups
CREATE INDEX ix_fee_current_balances_enrollment_id ON fee_current_balances(enrollment_id);
CREATE INDEX ix_fee_current_balances_component_code ON fee_current_balances(component_code);
CREATE INDEX ix_fee_current_balances_legacy_student_id ON fee_current_balances(legacy_student_id);
CREATE INDEX ix_fee_current_balances_source_system ON fee_current_balances(source_system) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_current_balances_import_batch ON fee_current_balances(import_batch_id) WHERE import_batch_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX ix_fee_current_balances_student_outstanding ON fee_current_balances(enrollment_id, outstanding_amount) WHERE outstanding_amount > 0 AND deleted_at IS NULL;
CREATE INDEX ix_fee_current_balances_year_component ON fee_current_balances(academic_year, component_code) WHERE deleted_at IS NULL;


-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

-- Table comments
COMMENT ON TABLE fee_current_balances IS 'Live current balances for fast lookups with legacy mapping support for migration';

-- Key column comments
COMMENT ON COLUMN fee_current_balances.legacy_student_id IS 'Maps to alpine_fees_feebalance.student_id for migration correlation';
COMMENT ON COLUMN fee_current_balances.legacy_balance_id IS 'Maps to alpine_fees_feebalance.id if available from legacy system';
COMMENT ON COLUMN fee_current_balances.legacy_course_id IS 'Maps to alpine_fees_feebalance.course_id for academic context';
COMMENT ON COLUMN fee_current_balances.legacy_session_id IS 'Maps to alpine_fees_feebalance.session_id for academic year context';
COMMENT ON COLUMN fee_current_balances.source_system IS 'Tracks origin of balance record (legacy_import, manual, automated, override)';
COMMENT ON COLUMN fee_current_balances.outstanding_amount IS 'Current balance owed: charged_amount - paid_amount';
COMMENT ON COLUMN fee_current_balances.charged_amount IS 'Amount student owes: override_amount - discount_amount';

-- Function comments
COMMENT ON FUNCTION get_current_balance(UUID, TEXT, INTEGER) IS 'Get current outstanding balance for enrollment-component-year combination';
COMMENT ON FUNCTION update_current_balance(UUID, TEXT, INTEGER, NUMERIC, UUID) IS 'Update paid amount and recalculate outstanding balance';
COMMENT ON FUNCTION sync_current_balances_from_ledger(UUID, TEXT) IS 'Sync current balances with ledger events for reconciliation';

-- ============================================================================
-- MIGRATION HELPER QUERIES (FOR REFERENCE)
-- ============================================================================

/*
-- Query to populate current balances from legacy feebalance data
INSERT INTO fee_current_balances (
    enrollment_id,
    academic_year,
    fee_component_id,
    component_code,
    component_name,
    year_number,
    original_amount,
    override_amount,
    charged_amount,
    outstanding_amount,
    legacy_student_id,
    legacy_course_id,
    legacy_session_id,
    source_system
)
SELECT 
    se.id as enrollment_id,
    CONCAT(EXTRACT(YEAR FROM acs.start_date), '-', RIGHT(EXTRACT(YEAR FROM acs.end_date)::TEXT, 2)) as academic_year,
    fc.id as fee_component_id,
    -- Map legacy components to new component codes
    CASE 
        WHEN legacy_component = 'REGISTRATION' THEN 'ADMISSION'
        WHEN legacy_component = 'TUITION' THEN 'TUITION'
        ELSE legacy_component
    END as component_code,
    fc.label as component_name,
    -- Determine year number from session or course context
    1 as year_number, -- Adjust logic based on your data
    legacy_original_amount,
    legacy_override_amount,
    legacy_override_amount as charged_amount,
    legacy_balance as outstanding_amount,
    legacy_student_id,
    legacy_course_id,
    legacy_session_id,
    'legacy_import'
FROM legacy_feebalance_staging lfs
JOIN student_enrollments se ON lfs.legacy_student_id = se.legacy_student_id
JOIN fee_components fc ON fc.code = CASE WHEN lfs.legacy_component = 'REGISTRATION' THEN 'ADMISSION' ELSE lfs.legacy_component END
JOIN academic_sessions acs ON lfs.legacy_session_id = acs.legacy_id;
*/
