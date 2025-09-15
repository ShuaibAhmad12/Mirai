-- 006_fee_ledger_system.sql
-- Comprehensive Fee Ledger System Implementation (Supabase Optimized)
-- Author: Alpine Education System
-- Purpose: Event-sourced fee ledger with legacy import staging and reconciliation

-- Enable required extensions (Supabase best practices)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUM TYPES FOR FEE SYSTEM
-- ============================================================================
-- Note: fee_components table already exists in 003_feestable.sql
-- We will reference fee_components.id instead of using enum

-- Fee ledger event types for audit trail
CREATE TYPE fee_ledger_event_type AS ENUM (
    'CHARGE_CREATED',
    'CHARGE_MODIFIED', 
    'CHARGE_CANCELLED',
    'PAYMENT_RECEIVED',
    'PAYMENT_CANCELLED',
    'ADJUSTMENT_MADE',
    'CARRY_FORWARD_APPLIED',
    'PENALTY_APPLIED',
    'DISCOUNT_APPLIED',
    'REFUND_ISSUED',
    'CANCELLED'
);

-- Payment method types
CREATE TYPE payment_method_type AS ENUM (
    'CASH',
    'CHEQUE',
    'BANK_TRANSFER',
    'BANK',
    'ONLINE',
    'DEMAND_DRAFT',
    'DD',
    'CARD',
    'SWIPE',
    'UPI',
    'WALLET',
    'QR_PHONEPE',
    'QR_HDFC', 
    'QR_PAYTM',
    'QR_GPAY',
    'QR_OTHER',
    'QR',
    'PHONEPE',
    'PAYTM',
    'GPAY',
    'OTHER'
);

-- Receipt status types
CREATE TYPE receipt_status_type AS ENUM (
    'ACTIVE',
    'CANCELLED',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
);

-- ============================================================================
-- NORMALIZED FEE LEDGER SYSTEM
-- ============================================================================
-- Note: Legacy CSV data will be transformed directly into normalized structure
-- No staging tables needed as transformation happens during import process

-- Core ledger events table (immutable event log)
CREATE TABLE fee_ledger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event identification
    event_type fee_ledger_event_type NOT NULL,
    event_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Student and academic context
    enrollment_id UUID NOT NULL,
    academic_year TEXT NOT NULL CHECK (length(academic_year) <= 10),
    
    -- Fee component details (references fee_components table from 003_feestable.sql)
    fee_component_id UUID NOT NULL REFERENCES fee_components(id),
    
    -- Financial amounts (NUMERIC preferred over DECIMAL in PostgreSQL)
    amount NUMERIC(12,2) NOT NULL,
    running_balance NUMERIC(12,2) NOT NULL,
    
    -- References
    receipt_id UUID, -- Links to fee_receipts for payment events
    fee_plan_id UUID, -- Links to fee plans for charge events
    reference_event_id UUID, -- Links to original event for cancellations/adjustments
    
    -- Audit and metadata
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Legacy data correlation
    legacy_receipt_id TEXT,
    legacy_balance_id TEXT,
    legacy_record_id TEXT,
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    CONSTRAINT chk_fee_ledger_events_academic_year CHECK (academic_year ~ '^\d{4}-\d{2}$'),
    CONSTRAINT chk_fee_ledger_events_amount_precision CHECK (amount = round(amount, 2)),
    CONSTRAINT chk_fee_ledger_events_balance_precision CHECK (running_balance = round(running_balance, 2)),
    CONSTRAINT fk_fee_ledger_events_reference FOREIGN KEY (reference_event_id) REFERENCES fee_ledger_events(id)
);

-- Fee receipts table (normalized receipt information)
CREATE TABLE fee_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Receipt identification
    receipt_number TEXT NOT NULL UNIQUE CHECK (length(receipt_number) <= 50),
    receipt_date DATE NOT NULL,
    
    -- Student context
    enrollment_id UUID NOT NULL,
    academic_year TEXT NOT NULL CHECK (length(academic_year) <= 10),
    
    -- Financial totals (NUMERIC preferred over DECIMAL in PostgreSQL)
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    paid_amount NUMERIC(12,2) NOT NULL CHECK (paid_amount >= 0),
    balance_amount NUMERIC(12,2) NOT NULL,
    
    -- Payment details
    payment_method payment_method_type NOT NULL,
    payment_reference TEXT CHECK (length(payment_reference) <= 100), -- Cheque number, transaction ID, etc.
    payment_date DATE, -- Same as receipt_date for legacy data
    bank_name TEXT CHECK (length(bank_name) <= 100), -- Will be NULL for legacy data
    remarks TEXT,
    
    -- Legacy component amounts (for easier transformation and validation)
    legacy_reg_fee NUMERIC(12,2), -- Registration/Admission fee from legacy
    legacy_sec_fee NUMERIC(12,2), -- Security fee from legacy
    legacy_tut_fee NUMERIC(12,2), -- Tuition fee from legacy
    legacy_other_fee NUMERIC(12,2), -- Other fee from legacy
    legacy_pre_bal NUMERIC(12,2), -- Previous balance from legacy
    legacy_rebate NUMERIC(12,2), -- Rebate/discount from legacy
    
    -- Status and lifecycle
    status receipt_status_type NOT NULL DEFAULT 'ACTIVE',
    
    -- Audit trail
    comments TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Legacy correlation
    legacy_receipt_id TEXT,
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    CONSTRAINT chk_fee_receipts_academic_year CHECK (academic_year ~ '^\d{4}-\d{2}$'),
    CONSTRAINT chk_fee_receipts_balance_calculation CHECK (balance_amount = total_amount - paid_amount),
    CONSTRAINT chk_fee_receipts_amount_precision CHECK (
        total_amount = round(total_amount, 2) AND 
        paid_amount = round(paid_amount, 2) AND 
        balance_amount = round(balance_amount, 2)
    ),
    CONSTRAINT chk_fee_receipts_payment_date CHECK (payment_date <= CURRENT_DATE),
    CONSTRAINT chk_fee_receipts_receipt_date CHECK (receipt_date <= CURRENT_DATE)
);

-- Fee receipt component allocations (optimized for performance and analytics)
CREATE TABLE fee_receipt_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    receipt_id UUID NOT NULL REFERENCES fee_receipts(id) ON DELETE CASCADE,
    ledger_event_id UUID NOT NULL REFERENCES fee_ledger_events(id),
    
    -- Allocation details (references fee_components table from 003_feestable.sql)
    fee_component_id UUID NOT NULL REFERENCES fee_components(id),
    allocated_amount NUMERIC(12,2) NOT NULL CHECK (allocated_amount > 0),
    
    -- Denormalized fields for performance (avoid joins in common queries)
    enrollment_id UUID NOT NULL, -- Denormalized from receipt
    academic_year TEXT NOT NULL CHECK (length(academic_year) <= 10), -- Denormalized from receipt
    receipt_date DATE NOT NULL, -- Denormalized from receipt
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Legacy correlation
    legacy_record_id TEXT,
    
    CONSTRAINT chk_fee_receipt_allocations_academic_year CHECK (academic_year ~ '^\d{4}-\d{2}$'),
    CONSTRAINT chk_fee_receipt_allocations_amount_precision CHECK (allocated_amount = round(allocated_amount, 2)),
    CONSTRAINT chk_fee_receipt_allocations_receipt_date CHECK (receipt_date <= CURRENT_DATE),
    CONSTRAINT uk_fee_receipt_allocations_receipt_component UNIQUE(receipt_id, fee_component_id)
);

-- Fee receipt balance records (pre-payment balance snapshots, optimized)
CREATE TABLE fee_receipt_balance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    receipt_id UUID NOT NULL REFERENCES fee_receipts(id) ON DELETE CASCADE,
    
    -- Balance snapshot (before this receipt payment) - references fee_components table
    fee_component_id UUID NOT NULL REFERENCES fee_components(id),
    charge_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,  
    balance_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    
    -- Denormalized fields for performance (avoid joins in common queries)
    enrollment_id UUID NOT NULL, -- Denormalized from receipt
    academic_year TEXT NOT NULL CHECK (length(academic_year) <= 10), -- Denormalized from receipt
    receipt_date DATE NOT NULL, -- Denormalized from receipt
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Legacy correlation
    legacy_record_id TEXT,
    
    CONSTRAINT chk_fee_receipt_balance_records_academic_year CHECK (academic_year ~ '^\d{4}-\d{2}$'),
    CONSTRAINT chk_fee_receipt_balance_records_amount_precision CHECK (
        charge_amount = round(charge_amount, 2) AND 
        paid_amount = round(paid_amount, 2) AND 
        balance_amount = round(balance_amount, 2)
    ),
    CONSTRAINT chk_fee_receipt_balance_records_balance_calculation CHECK (balance_amount = charge_amount - paid_amount),
    CONSTRAINT chk_fee_receipt_balance_records_receipt_date CHECK (receipt_date <= CURRENT_DATE),
    CONSTRAINT uk_fee_receipt_balance_records_receipt_component UNIQUE(receipt_id, fee_component_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE (Supabase Optimized)
-- ============================================================================

-- Core ledger event indexes (improved naming and partial indexes)
CREATE INDEX ix_fee_ledger_events_enrollment_year ON fee_ledger_events(enrollment_id, academic_year) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_ledger_events_component_date ON fee_ledger_events(fee_component_id, event_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_ledger_events_receipt_id ON fee_ledger_events(receipt_id) WHERE receipt_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_fee_ledger_events_legacy_receipt_id ON fee_ledger_events(legacy_receipt_id) WHERE legacy_receipt_id IS NOT NULL;
CREATE INDEX ix_fee_ledger_events_event_type ON fee_ledger_events(event_type) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_ledger_events_event_date ON fee_ledger_events(event_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_ledger_events_amount ON fee_ledger_events(amount) WHERE deleted_at IS NULL AND amount != 0;

-- Receipt indexes (improved naming and partial indexes)
CREATE INDEX ix_fee_receipts_enrollment_year ON fee_receipts(enrollment_id, academic_year) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_receipts_receipt_date ON fee_receipts(receipt_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_receipts_status ON fee_receipts(status) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_receipts_payment_method ON fee_receipts(payment_method) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_receipts_legacy_receipt_id ON fee_receipts(legacy_receipt_id) WHERE legacy_receipt_id IS NOT NULL;
CREATE INDEX ix_fee_receipts_receipt_number ON fee_receipts(receipt_number) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_receipts_total_amount ON fee_receipts(total_amount) WHERE deleted_at IS NULL AND total_amount > 0;

-- Allocation indexes (optimized for analytics and reporting)
CREATE INDEX ix_fee_receipt_allocations_receipt_id ON fee_receipt_allocations(receipt_id);
CREATE INDEX ix_fee_receipt_allocations_component_id ON fee_receipt_allocations(fee_component_id);
CREATE INDEX ix_fee_receipt_allocations_enrollment_year ON fee_receipt_allocations(enrollment_id, academic_year);
CREATE INDEX ix_fee_receipt_allocations_component_year ON fee_receipt_allocations(fee_component_id, academic_year);
CREATE INDEX ix_fee_receipt_allocations_receipt_date ON fee_receipt_allocations(receipt_date DESC);
CREATE INDEX ix_fee_receipt_allocations_allocated_amount ON fee_receipt_allocations(allocated_amount) WHERE allocated_amount > 0;
CREATE INDEX ix_fee_receipt_allocations_legacy_record_id ON fee_receipt_allocations(legacy_record_id) WHERE legacy_record_id IS NOT NULL;

-- Balance record indexes (optimized for analytics and reporting)
CREATE INDEX ix_fee_receipt_balance_records_receipt_id ON fee_receipt_balance_records(receipt_id);
CREATE INDEX ix_fee_receipt_balance_records_component_id ON fee_receipt_balance_records(fee_component_id);
CREATE INDEX ix_fee_receipt_balance_records_enrollment_year ON fee_receipt_balance_records(enrollment_id, academic_year);
CREATE INDEX ix_fee_receipt_balance_records_component_year ON fee_receipt_balance_records(fee_component_id, academic_year);
CREATE INDEX ix_fee_receipt_balance_records_receipt_date ON fee_receipt_balance_records(receipt_date DESC);
CREATE INDEX ix_fee_receipt_balance_records_balance_amount ON fee_receipt_balance_records(balance_amount) WHERE balance_amount > 0;

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_generic_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers
CREATE TRIGGER trigger_fee_receipts_audit 
    BEFORE UPDATE ON fee_receipts 
    FOR EACH ROW EXECUTE FUNCTION audit_generic_trigger();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to compute current balance for enrollment + component (Supabase optimized)
CREATE OR REPLACE FUNCTION compute_enrollment_component_balance(
    p_enrollment_id UUID,
    p_fee_component_id UUID,
    p_academic_year TEXT
) RETURNS NUMERIC(12,2) 
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
    current_balance NUMERIC(12,2) := 0;
BEGIN
    -- Input validation
    IF p_enrollment_id IS NULL OR p_fee_component_id IS NULL OR p_academic_year IS NULL THEN
        RAISE EXCEPTION 'All parameters must be non-null';
    END IF;
    
    IF NOT (p_academic_year ~ '^\d{4}-\d{2}$') THEN
        RAISE EXCEPTION 'Academic year must be in format YYYY-YY';
    END IF;
    
    SELECT COALESCE(SUM(
        CASE 
            WHEN event_type IN ('CHARGE_CREATED', 'PENALTY_APPLIED', 'CARRY_FORWARD_APPLIED') THEN amount
            WHEN event_type IN ('PAYMENT_RECEIVED', 'DISCOUNT_APPLIED') THEN -amount
            WHEN event_type IN ('CHARGE_CANCELLED', 'PAYMENT_CANCELLED') THEN -amount
            WHEN event_type = 'REFUND_ISSUED' THEN amount
            ELSE 0
        END
    ), 0) INTO current_balance
    FROM fee_ledger_events
    WHERE enrollment_id = p_enrollment_id
      AND fee_component_id = p_fee_component_id
      AND academic_year = p_academic_year
      AND deleted_at IS NULL;
    
    RETURN round(current_balance, 2);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error computing balance: %', SQLERRM;
END;
$$;

-- Function to cancel a receipt and create reversal events (Supabase optimized)
CREATE OR REPLACE FUNCTION cancel_receipt(
    p_receipt_id UUID,
    p_cancelled_by UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    receipt_record RECORD;
    allocation_record RECORD;
    cancellation_count INTEGER := 0;
BEGIN
    -- Input validation
    IF p_receipt_id IS NULL OR p_cancelled_by IS NULL THEN
        RAISE EXCEPTION 'Receipt ID and cancelled_by user ID must be provided';
    END IF;
    
    -- Get receipt details with row-level lock
    SELECT * INTO receipt_record 
    FROM fee_receipts 
    WHERE id = p_receipt_id 
      AND status = 'ACTIVE' 
      AND deleted_at IS NULL
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Receipt not found, already cancelled, or deleted';
    END IF;
    
    -- Create reversal events for each allocation in a transaction
    FOR allocation_record IN 
        SELECT fra.*, fr.enrollment_id, fr.academic_year
        FROM fee_receipt_allocations fra
        JOIN fee_receipts fr ON fra.receipt_id = fr.id
        WHERE fra.receipt_id = p_receipt_id
        ORDER BY fra.fee_component_id
    LOOP
        INSERT INTO fee_ledger_events (
            event_type,
            enrollment_id,
            academic_year,
            fee_component_id,
            amount,
            running_balance,
            receipt_id,
            reference_event_id,
            description,
            created_by
        ) VALUES (
            'PAYMENT_CANCELLED',
            allocation_record.enrollment_id,
            allocation_record.academic_year,
            allocation_record.fee_component_id,
            allocation_record.allocated_amount,
            compute_enrollment_component_balance(
                allocation_record.enrollment_id,
                allocation_record.fee_component_id,
                allocation_record.academic_year
            ) + allocation_record.allocated_amount,
            p_receipt_id,
            allocation_record.ledger_event_id,
            COALESCE(p_reason, 'Receipt cancellation'),
            p_cancelled_by
        );
        
        cancellation_count := cancellation_count + 1;
    END LOOP;
    
    -- Update receipt status
    UPDATE fee_receipts 
    SET status = 'CANCELLED',
        updated_by = p_cancelled_by,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_receipt_id;
    
    -- Log the cancellation
    RAISE NOTICE 'Receipt % cancelled successfully with % allocation reversals', p_receipt_id, cancellation_count;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error cancelling receipt %: %', p_receipt_id, SQLERRM;
END;
$$;

-- ============================================================================
-- BUSINESS LOGIC VIEWS
-- ============================================================================

-- Current fee balances by enrollment and component
CREATE VIEW view_fee_current_balances AS
SELECT 
    fle.enrollment_id,
    fle.academic_year,
    fle.fee_component_id,
    fc.code as fee_component_code,
    fc.label as fee_component_label,
    SUM(CASE 
        WHEN event_type IN ('CHARGE_CREATED', 'PENALTY_APPLIED', 'CARRY_FORWARD_APPLIED') THEN amount
        WHEN event_type IN ('PAYMENT_RECEIVED', 'DISCOUNT_APPLIED') THEN -amount
        WHEN event_type IN ('CHARGE_CANCELLED', 'PAYMENT_CANCELLED') THEN -amount
        WHEN event_type = 'REFUND_ISSUED' THEN amount
        ELSE 0
    END) AS current_balance,
    SUM(CASE 
        WHEN event_type IN ('CHARGE_CREATED', 'PENALTY_APPLIED', 'CARRY_FORWARD_APPLIED') THEN amount
        ELSE 0
    END) AS total_charges,
    SUM(CASE 
        WHEN event_type IN ('PAYMENT_RECEIVED', 'DISCOUNT_APPLIED') THEN amount
        ELSE 0
    END) AS total_payments,
    COUNT(*) AS event_count,
    MAX(event_date) AS last_activity_date
FROM fee_ledger_events fle
JOIN fee_components fc ON fle.fee_component_id = fc.id
WHERE fle.deleted_at IS NULL
GROUP BY fle.enrollment_id, fle.academic_year, fle.fee_component_id, fc.code, fc.label
HAVING SUM(CASE 
    WHEN event_type IN ('CHARGE_CREATED', 'PENALTY_APPLIED', 'CARRY_FORWARD_APPLIED') THEN amount
    WHEN event_type IN ('PAYMENT_RECEIVED', 'DISCOUNT_APPLIED') THEN -amount
    WHEN event_type IN ('CHARGE_CANCELLED', 'PAYMENT_CANCELLED') THEN -amount
    WHEN event_type = 'REFUND_ISSUED' THEN amount
    ELSE 0
END) != 0
ORDER BY fle.enrollment_id, fle.academic_year, fc.code;

-- Annual fee summary by enrollment
CREATE VIEW view_fee_year_summary AS
SELECT 
    enrollment_id,
    academic_year,
    SUM(CASE 
        WHEN event_type IN ('CHARGE_CREATED', 'PENALTY_APPLIED', 'CARRY_FORWARD_APPLIED') THEN amount
        ELSE 0
    END) AS total_charges,
    SUM(CASE 
        WHEN event_type IN ('PAYMENT_RECEIVED', 'DISCOUNT_APPLIED') THEN amount
        ELSE 0
    END) AS total_payments,
    SUM(CASE 
        WHEN event_type IN ('CHARGE_CREATED', 'PENALTY_APPLIED', 'CARRY_FORWARD_APPLIED') THEN amount
        WHEN event_type IN ('PAYMENT_RECEIVED', 'DISCOUNT_APPLIED') THEN -amount
        WHEN event_type IN ('CHARGE_CANCELLED', 'PAYMENT_CANCELLED') THEN -amount
        WHEN event_type = 'REFUND_ISSUED' THEN amount
        ELSE 0
    END) AS outstanding_balance,
    COUNT(DISTINCT receipt_id) FILTER (WHERE receipt_id IS NOT NULL) AS receipt_count,
    MIN(event_date) AS first_activity,
    MAX(event_date) AS last_activity
FROM fee_ledger_events
WHERE deleted_at IS NULL
GROUP BY enrollment_id, academic_year
ORDER BY enrollment_id, academic_year;

-- Fee receipt details with allocations (optimized view)
CREATE VIEW view_fee_receipt_details AS
SELECT 
    r.id as receipt_id,
    r.receipt_number,
    r.receipt_date,
    r.enrollment_id,
    r.academic_year,
    r.total_amount,
    r.paid_amount,
    r.balance_amount,
    r.payment_method,
    r.payment_reference,
    r.status,
    a.fee_component_id,
    fc.code as fee_component_code,
    fc.label as fee_component_label,
    a.allocated_amount,
    brr.charge_amount as pre_payment_charge,
    brr.paid_amount as pre_payment_paid,
    brr.balance_amount as pre_payment_balance,
    r.created_at as receipt_created_at
FROM fee_receipts r
LEFT JOIN fee_receipt_allocations a ON r.id = a.receipt_id
LEFT JOIN fee_components fc ON a.fee_component_id = fc.id
LEFT JOIN fee_receipt_balance_records brr ON r.id = brr.receipt_id AND a.fee_component_id = brr.fee_component_id
WHERE r.deleted_at IS NULL
ORDER BY r.receipt_date DESC, r.receipt_number, fc.code;

-- Materialized view for fee analytics (refresh periodically for performance) - Supabase optimized
CREATE MATERIALIZED VIEW mv_fee_analytics_summary AS
SELECT 
    fra.enrollment_id,
    fra.academic_year,
    fra.fee_component_id,
    fc.code as fee_component_code,
    fc.label as fee_component_label,
    COUNT(DISTINCT fra.receipt_id) as receipt_count,
    SUM(fra.allocated_amount)::NUMERIC(12,2) as total_allocated,
    AVG(fra.allocated_amount)::NUMERIC(12,2) as avg_allocation,
    MIN(fra.receipt_date) as first_payment_date,
    MAX(fra.receipt_date) as last_payment_date,
    SUM(CASE WHEN fra.receipt_date >= CURRENT_DATE - INTERVAL '30 days' THEN fra.allocated_amount ELSE 0 END)::NUMERIC(12,2) as recent_30d_allocated,
    SUM(CASE WHEN fra.receipt_date >= CURRENT_DATE - INTERVAL '90 days' THEN fra.allocated_amount ELSE 0 END)::NUMERIC(12,2) as recent_90d_allocated,
    -- Additional analytics fields
    COUNT(CASE WHEN fra.receipt_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_30d_payment_count,
    COUNT(CASE WHEN fra.receipt_date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as recent_90d_payment_count,
    EXTRACT(YEAR FROM MAX(fra.receipt_date))::INTEGER as last_payment_year,
    EXTRACT(MONTH FROM MAX(fra.receipt_date))::INTEGER as last_payment_month
FROM fee_receipt_allocations fra
JOIN fee_components fc ON fra.fee_component_id = fc.id
JOIN fee_receipts fr ON fra.receipt_id = fr.id 
WHERE fr.deleted_at IS NULL 
  AND fr.status = 'ACTIVE'
GROUP BY fra.enrollment_id, fra.academic_year, fra.fee_component_id, fc.code, fc.label;

-- Indexes for materialized view (improved)
CREATE UNIQUE INDEX ix_mv_fee_analytics_summary_unique ON mv_fee_analytics_summary(enrollment_id, academic_year, fee_component_id);
CREATE INDEX ix_mv_fee_analytics_summary_enrollment_year ON mv_fee_analytics_summary(enrollment_id, academic_year);
CREATE INDEX ix_mv_fee_analytics_summary_component_id ON mv_fee_analytics_summary(fee_component_id);
CREATE INDEX ix_mv_fee_analytics_summary_total_allocated ON mv_fee_analytics_summary(total_allocated DESC);
CREATE INDEX ix_mv_fee_analytics_summary_academic_year ON mv_fee_analytics_summary(academic_year);
CREATE INDEX ix_mv_fee_analytics_summary_last_payment ON mv_fee_analytics_summary(last_payment_date DESC);

-- Function to refresh materialized view (Supabase optimized)
CREATE OR REPLACE FUNCTION refresh_fee_analytics() 
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Refresh with concurrent option for better performance
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fee_analytics_summary;
    
    -- Log the refresh
    RAISE NOTICE 'Fee analytics materialized view refreshed at %', CURRENT_TIMESTAMP;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error refreshing fee analytics: %', SQLERRM;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - ESSENTIAL FOR SUPABASE
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE fee_ledger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_receipt_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_receipt_balance_records ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (customize based on your auth requirements)
-- These are template policies - adjust based on your actual user roles and permissions

-- Fee ledger events policies
CREATE POLICY "fee_ledger_events_select_policy" ON fee_ledger_events
    FOR SELECT USING (
        -- Allow if user has access to the enrollment (implement your logic here)
        enrollment_id IN (
            SELECT enrollment_id FROM user_enrollments 
            WHERE user_id = auth.uid()
        )
        OR 
        -- Allow for admin users
        auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "fee_ledger_events_insert_policy" ON fee_ledger_events
    FOR INSERT WITH CHECK (
        -- Only admin or finance staff can insert
        auth.jwt() ->> 'role' IN ('admin', 'finance')
    );

-- Fee receipts policies
CREATE POLICY "fee_receipts_select_policy" ON fee_receipts
    FOR SELECT USING (
        enrollment_id IN (
            SELECT enrollment_id FROM user_enrollments 
            WHERE user_id = auth.uid()
        )
        OR 
        auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "fee_receipts_insert_policy" ON fee_receipts
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' IN ('admin', 'finance')
    );

CREATE POLICY "fee_receipts_update_policy" ON fee_receipts
    FOR UPDATE USING (
        auth.jwt() ->> 'role' IN ('admin', 'finance')
    );

-- Fee receipt allocations policies
CREATE POLICY "fee_receipt_allocations_select_policy" ON fee_receipt_allocations
    FOR SELECT USING (
        enrollment_id IN (
            SELECT enrollment_id FROM user_enrollments 
            WHERE user_id = auth.uid()
        )
        OR 
        auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "fee_receipt_allocations_insert_policy" ON fee_receipt_allocations
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' IN ('admin', 'finance')
    );

-- Fee receipt balance records policies
CREATE POLICY "fee_receipt_balance_records_select_policy" ON fee_receipt_balance_records
    FOR SELECT USING (
        enrollment_id IN (
            SELECT enrollment_id FROM user_enrollments 
            WHERE user_id = auth.uid()
        )
        OR 
        auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "fee_receipt_balance_records_insert_policy" ON fee_receipt_balance_records
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' IN ('admin', 'finance')
    );

-- ============================================================================
-- COMMENTS AND DOCUMENTATION (Enhanced for Supabase)
-- ============================================================================

-- Table comments
COMMENT ON TABLE fee_ledger_events IS 'Immutable event log for all fee-related transactions with full audit trail';
COMMENT ON TABLE fee_receipts IS 'Normalized fee receipt information with payment details and legacy component amounts';
COMMENT ON TABLE fee_receipt_allocations IS 'How receipt payments are allocated across fee components with denormalized performance fields';
COMMENT ON TABLE fee_receipt_balance_records IS 'Pre-payment balance snapshots for each receipt with denormalized analytics support';

-- Column comments for key fields (enhanced)
COMMENT ON COLUMN fee_ledger_events.running_balance IS 'Balance after this event is applied (NUMERIC 12,2 for precision)';
COMMENT ON COLUMN fee_ledger_events.reference_event_id IS 'Links to original event for cancellations/adjustments (self-referencing FK)';
COMMENT ON COLUMN fee_ledger_events.fee_component_id IS 'References fee_components table from 003_feestable.sql';
COMMENT ON COLUMN fee_ledger_events.event_date IS 'Timezone-aware timestamp using TIMESTAMPTZ for global compatibility';
COMMENT ON COLUMN fee_receipts.balance_amount IS 'Calculated as total_amount - paid_amount with CHECK constraint enforcement';
COMMENT ON COLUMN fee_receipts.legacy_reg_fee IS 'Maps to reg_fee from alpine_fees_feereceipts CSV (NUMERIC for precision)';
COMMENT ON COLUMN fee_receipts.legacy_sec_fee IS 'Maps to sec_fee from alpine_fees_feereceipts CSV (NUMERIC for precision)';
COMMENT ON COLUMN fee_receipts.legacy_tut_fee IS 'Maps to tut_fee from alpine_fees_feereceipts CSV (NUMERIC for precision)';
COMMENT ON COLUMN fee_receipts.legacy_other_fee IS 'Maps to other_fee from alpine_fees_feereceipts CSV (NUMERIC for precision)';
COMMENT ON COLUMN fee_receipts.legacy_pre_bal IS 'Maps to pre_bal from alpine_fees_feereceipts CSV (NUMERIC for precision)';
COMMENT ON COLUMN fee_receipts.legacy_rebate IS 'Maps to rebate from alpine_fees_feereceipts CSV (NUMERIC for precision)';
COMMENT ON COLUMN fee_receipt_balance_records.charge_amount IS 'Outstanding charge before this receipt payment (denormalized for performance)';
COMMENT ON COLUMN fee_receipt_balance_records.balance_amount IS 'Outstanding balance before this receipt payment (denormalized for performance)';

-- ============================================================================
-- SUPABASE SPECIFIC OPTIMIZATIONS AND BEST PRACTICES
-- ============================================================================

-- Grant necessary permissions for Supabase service role
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant specific permissions for materialized view refresh
GRANT SELECT ON mv_fee_analytics_summary TO authenticated, anon;

-- Performance monitoring queries (for Supabase dashboard)
-- Uncomment these when you want to monitor performance

/*
-- Query to monitor table sizes
SELECT 
    schemaname,
    tablename,
    attname,
    null_frac,
    avg_width,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename LIKE 'fee_%' 
ORDER BY schemaname, tablename, attname;

-- Query to monitor index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename LIKE 'fee_%'
ORDER BY idx_scan DESC;
*/

-- ============================================================================
-- ADDITIONAL SUPABASE BEST PRACTICES SUMMARY
-- ============================================================================
/*
IMPLEMENTED SUPABASE BEST PRACTICES:

✅ 1. TEXT instead of VARCHAR - All variable strings use TEXT with CHECK constraints for length limits
✅ 2. TIMESTAMPTZ instead of TIMESTAMP - All timestamps are timezone-aware
✅ 3. NUMERIC instead of DECIMAL - Better precision and PostgreSQL native support
✅ 4. gen_random_uuid() instead of uuid_generate_v4() - More secure UUID generation
✅ 5. Row Level Security (RLS) - Enabled on all tables with basic policies
✅ 6. Proper constraint naming - All constraints follow consistent naming patterns
✅ 7. Function security - Functions marked with SECURITY INVOKER/DEFINER appropriately
✅ 8. Partial indexes - WHERE clauses on indexes for better performance
✅ 9. Input validation - Functions validate parameters and handle errors properly
✅ 10. Proper grants - Appropriate permissions for authenticated users
✅ 11. CASCADE options - ON DELETE CASCADE where appropriate for data integrity
✅ 12. CHECK constraints - Data validation at database level
✅ 13. Index optimization - Composite indexes ordered by selectivity
✅ 14. Materialized view optimization - CONCURRENTLY refresh support

CUSTOMIZE THESE AREAS FOR YOUR SPECIFIC USE CASE:
🔧 1. RLS policies - Update to match your actual user/role system
🔧 2. User enrollment table reference - Adjust based on your user management
🔧 3. Auth role checks - Modify role names to match your authentication setup
🔧 4. Monitoring queries - Uncomment and customize for your dashboard needs
*/