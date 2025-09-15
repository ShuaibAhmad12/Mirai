-- PostgreSQL Import Script for Fee Ledger Data
-- Run this script after ensuring the 006_fee_ledger_system.sql schema is deployed
-- Note: Fee components already exist in database, so we skip importing them

-- Import fee receipts
\copy fee_receipts(id, receipt_number, receipt_date, enrollment_id, academic_year, total_amount, paid_amount, balance_amount, payment_method, payment_reference, payment_date, bank_name, legacy_reg_fee, legacy_sec_fee, legacy_tut_fee, legacy_other_fee, legacy_pre_bal, legacy_rebate, status, comments, created_by, updated_by, created_at, updated_at, legacy_receipt_id) FROM 'transformed_fee_receipts.csv' WITH CSV HEADER;

-- Import fee ledger events
\copy fee_ledger_events(id, event_type, event_date, enrollment_id, academic_year, fee_component_id, amount, running_balance, receipt_id, fee_plan_id, reference_event_id, description, created_by, created_at, legacy_receipt_id, legacy_balance_id, legacy_record_id) FROM 'transformed_fee_ledger_events.csv' WITH CSV HEADER;

-- Import fee receipt allocations
\copy fee_receipt_allocations(id, receipt_id, ledger_event_id, fee_component_id, allocated_amount, enrollment_id, academic_year, receipt_date, created_at, legacy_record_id) FROM 'transformed_fee_receipt_allocations.csv' WITH CSV HEADER;

-- Import fee receipt balance records
\copy fee_receipt_balance_records(id, receipt_id, fee_component_id, charge_amount, paid_amount, balance_amount, enrollment_id, academic_year, receipt_date, created_at, legacy_record_id) FROM 'transformed_fee_receipt_balance_records.csv' WITH CSV HEADER;

-- Refresh analytics materialized view
SELECT refresh_fee_analytics();

-- Verify import
SELECT 'Fee Receipts' as table_name, COUNT(*) as record_count FROM fee_receipts
UNION ALL
SELECT 'Ledger Events', COUNT(*) FROM fee_ledger_events  
UNION ALL
SELECT 'Allocations', COUNT(*) FROM fee_receipt_allocations
UNION ALL
SELECT 'Balance Records', COUNT(*) FROM fee_receipt_balance_records;
