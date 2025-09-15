-- 006.5_fee_adjustments.sql
-- Fee Adjustments System (Simple Discounts, Penalties, Scholarships)
-- Author: Alpine Education System
-- Purpose: Simple fee adjustment tracking with audit logging
-- Depends on: 006_fee_ledger_system.sql, 006.1_fee_current_balances.sql

-- ============================================================================
-- ADJUSTMENT TYPES AND ENUMS
-- ============================================================================

-- Fee adjustment types (simple version)
CREATE TYPE fee_adjustment_type AS ENUM (
    'DISCOUNT',        -- General discount
    'PENALTY',         -- Late fee, violation penalty
    'SCHOLARSHIP',     -- Merit/need-based scholarship
    'WAIVER',          -- Fee waiver (full or partial)
    'OTHER'            -- Other adjustments
);

-- Adjustment status types (simplified)
CREATE TYPE fee_adjustment_status AS ENUM (
    'ACTIVE',          -- Applied and active
    'CANCELLED'        -- Cancelled/reversed
);

-- ============================================================================
-- SIMPLE FEE ADJUSTMENTS TABLE
-- ============================================================================

-- Simple fee adjustments table
CREATE TABLE fee_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Student and academic context
    enrollment_id UUID NOT NULL REFERENCES student_enrollments(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL CHECK (academic_year ~ '^\d{4}-\d{2}$'),
    
    -- Fee component context
    fee_component_id UUID REFERENCES fee_components(id) ON DELETE SET NULL,
    
    -- Adjustment details
    adjustment_type fee_adjustment_type NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    
    -- Business context
    title TEXT NOT NULL CHECK (length(title) <= 200), -- Short description
    reason TEXT NOT NULL, -- Detailed reason/justification
    
    -- Status
    status fee_adjustment_status NOT NULL DEFAULT 'ACTIVE',
    
    -- Effective date
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Audit trail
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Cancellation tracking
    cancelled_by UUID,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    -- Legacy correlation
    legacy_adjustment_id TEXT,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    -- Simple constraints
    CONSTRAINT chk_fee_adjustments_cancellation_consistency CHECK (
        (status = 'CANCELLED' AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL) OR
        (status != 'CANCELLED')
    )
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Simple indexes for essential queries
CREATE INDEX ix_fee_adjustments_enrollment_year ON fee_adjustments(enrollment_id, academic_year) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_adjustments_component_type ON fee_adjustments(fee_component_id, adjustment_type) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_adjustments_status_date ON fee_adjustments(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_adjustments_effective_date ON fee_adjustments(effective_date) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_adjustments_created_by ON fee_adjustments(created_by, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_fee_adjustments_legacy_id ON fee_adjustments(legacy_adjustment_id) WHERE legacy_adjustment_id IS NOT NULL;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE fee_adjustments IS 'Simple fee adjustments with basic audit trail';
