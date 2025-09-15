-- Database Triggers Export
-- Generated on: Mon Sep 15 08:16:46 IST 2025

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

-- Triggers from schema: auth
-- Total triggers: 1

-- Trigger: on_auth_user_created
-- Table: auth.users
-- Event: AFTER INSERT
-- Function: handle_new_user
CREATE TRIGGER on_auth_user_created
    AFTER INSERT
    ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

