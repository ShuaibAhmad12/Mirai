-- Enum Types Export
-- Generated on: Mon Sep 15 11:54:27 IST 2025

DROP TYPE IF EXISTS public.affiliation_type CASCADE;
DROP TYPE IF EXISTS public.assignment_scope CASCADE;
DROP TYPE IF EXISTS public.assignment_status CASCADE;
DROP TYPE IF EXISTS public.college_status CASCADE;
DROP TYPE IF EXISTS public.college_type CASCADE;
DROP TYPE IF EXISTS public.course_status CASCADE;
DROP TYPE IF EXISTS public.course_type CASCADE;
DROP TYPE IF EXISTS public.department_type CASCADE;
DROP TYPE IF EXISTS public.duration_unit CASCADE;
DROP TYPE IF EXISTS public.employment_type CASCADE;
DROP TYPE IF EXISTS public.fee_adjustment_status CASCADE;
DROP TYPE IF EXISTS public.fee_adjustment_type CASCADE;
DROP TYPE IF EXISTS public.fee_ledger_event_type CASCADE;
DROP TYPE IF EXISTS public.invite_status CASCADE;
DROP TYPE IF EXISTS public.onboarding_status CASCADE;
DROP TYPE IF EXISTS public.payment_method_type CASCADE;
DROP TYPE IF EXISTS public.permission_operation_type CASCADE;
DROP TYPE IF EXISTS public.receipt_status_type CASCADE;
DROP TYPE IF EXISTS public.resource_type CASCADE;
DROP TYPE IF EXISTS public.role_status CASCADE;
DROP TYPE IF EXISTS public.role_type CASCADE;
DROP TYPE IF EXISTS public.session_status CASCADE;
DROP TYPE IF EXISTS public.user_account_status CASCADE;
DROP TYPE IF EXISTS public.user_status_type CASCADE;

CREATE TYPE public.affiliation_type AS ENUM ('ugc', 'aicte', 'state_board', 'autonomous', 'deemed', 'private');
CREATE TYPE public.assignment_scope AS ENUM ('system', 'college', 'department', 'course', 'session');
CREATE TYPE public.assignment_status AS ENUM ('active', 'inactive', 'suspended', 'expired');
CREATE TYPE public.college_status AS ENUM ('active', 'inactive', 'suspended', 'archived');
CREATE TYPE public.college_type AS ENUM ('university', 'college', 'institute', 'school', 'training_center');
CREATE TYPE public.course_status AS ENUM ('draft', 'active', 'inactive', 'discontinued');
CREATE TYPE public.course_type AS ENUM ('undergraduate', 'postgraduate', 'diploma', 'certificate', 'professional', 'vocational');
CREATE TYPE public.department_type AS ENUM ('ACADEMIC', 'ADMINISTRATION', 'FINANCE', 'HR', 'IT', 'LIBRARY', 'HOSTELS', 'TRANSPORT', 'MAINTENANCE', 'SECURITY');
CREATE TYPE public.duration_unit AS ENUM ('months', 'years', 'semesters', 'terms');
CREATE TYPE public.employment_type AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'VISITING', 'EMERITUS', 'INTERN');
CREATE TYPE public.fee_adjustment_status AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE public.fee_adjustment_type AS ENUM ('DISCOUNT', 'PENALTY', 'SCHOLARSHIP', 'WAIVER', 'OTHER');
CREATE TYPE public.fee_ledger_event_type AS ENUM ('CHARGE_CREATED', 'CHARGE_MODIFIED', 'CHARGE_CANCELLED', 'PAYMENT_RECEIVED', 'PAYMENT_CANCELLED', 'ADJUSTMENT_MADE', 'CARRY_FORWARD_APPLIED', 'PENALTY_APPLIED', 'DISCOUNT_APPLIED', 'REFUND_ISSUED', 'CANCELLED');
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE public.onboarding_status AS ENUM ('not_started', 'in_progress', 'completed', 'skipped');
CREATE TYPE public.payment_method_type AS ENUM ('CASH', 'CHEQUE', 'BANK_TRANSFER', 'BANK', 'ONLINE', 'DEMAND_DRAFT', 'DD', 'CARD', 'SWIPE', 'UPI', 'WALLET', 'QR_PHONEPE', 'QR_HDFC', 'QR_PAYTM', 'QR_GPAY', 'QR_OTHER', 'QR', 'PHONEPE', 'PAYTM', 'GPAY', 'OTHER');
CREATE TYPE public.permission_operation_type AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT', 'BULK_UPDATE', 'REPORT_VIEW', 'ADMIN_ACCESS');
CREATE TYPE public.receipt_status_type AS ENUM ('ACTIVE', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE public.resource_type AS ENUM ('STUDENTS', 'STAFF', 'COURSES', 'FEES', 'ADMISSIONS', 'ACADEMIC_SESSIONS', 'REPORTS', 'USER_MANAGEMENT', 'SYSTEM_SETTINGS', 'AUDIT_LOGS', 'NOTIFICATIONS', 'ASSESSMENTS', 'ATTENDANCE', 'LIBRARY', 'HOSTELS', 'TRANSPORT', 'INVENTORY');
CREATE TYPE public.role_status AS ENUM ('active', 'inactive', 'deprecated');
CREATE TYPE public.role_type AS ENUM ('system', 'institutional', 'departmental', 'custom');
CREATE TYPE public.session_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
CREATE TYPE public.user_account_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification', 'invited');
CREATE TYPE public.user_status_type AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'LOCKED', 'EXPIRED');

