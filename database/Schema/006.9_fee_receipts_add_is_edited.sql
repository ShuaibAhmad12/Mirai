-- Migration: Add is_edited flag to fee_receipts to track edits without mutating remarks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fee_receipts' AND column_name = 'is_edited'
  ) THEN
    ALTER TABLE fee_receipts
      ADD COLUMN is_edited BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added column fee_receipts.is_edited';
  END IF;

  -- Optional index if querying frequently on edited receipts
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='fee_receipts' AND indexname='ix_fee_receipts_is_edited'
  ) THEN
    CREATE INDEX ix_fee_receipts_is_edited ON fee_receipts(is_edited) WHERE deleted_at IS NULL;
  END IF;
END $$;
