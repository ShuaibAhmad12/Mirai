-- Temporarily remove foreign key constraints to allow import
-- Run this before importing the CSV data

ALTER TABLE fee_current_balances DROP CONSTRAINT IF EXISTS fk_fee_current_balances_fee_component;
ALTER TABLE fee_current_balances DROP CONSTRAINT IF EXISTS fk_fee_current_balances_enrollment;
