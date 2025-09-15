-- Database Triggers Export
-- Generated on: Mon Sep 15 11:54:35 IST 2025

-- Triggers from schema: public
-- Total triggers: 1

-- Trigger: trg_student_fee_overrides_updated_by
-- Table: public.student_fee_overrides
-- Event: BEFORE UPDATE
-- Function: update_student_fee_overrides_updated_by
CREATE TRIGGER trg_student_fee_overrides_updated_by
    BEFORE UPDATE
    ON public.student_fee_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_student_fee_overrides_updated_by();

