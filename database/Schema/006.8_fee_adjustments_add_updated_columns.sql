-- Migration: Add updated_at and updated_by columns to fee_adjustments
-- Reason: Required by update_fee_payment function for audit updates
-- Safe to run multiple times (uses IF NOT EXISTS guards via dynamic checks)

DO $$
BEGIN
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fee_adjustments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE fee_adjustments
      ADD COLUMN updated_at TIMESTAMPTZ;
    RAISE NOTICE 'Added column fee_adjustments.updated_at';
  END IF;

  -- Add updated_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fee_adjustments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE fee_adjustments
      ADD COLUMN updated_by UUID;
    RAISE NOTICE 'Added column fee_adjustments.updated_by';
  END IF;
END $$;

-- Optional: index for recent updates if querying by updated_at
CREATE INDEX IF NOT EXISTS ix_fee_adjustments_updated_at ON fee_adjustments(updated_at DESC) WHERE deleted_at IS NULL;

-- Optional: index for updated_by auditing
CREATE INDEX IF NOT EXISTS ix_fee_adjustments_updated_by ON fee_adjustments(updated_by) WHERE deleted_at IS NULL;
