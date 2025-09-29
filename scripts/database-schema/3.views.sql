-- Database Views Export
-- Generated on: Tue Sep 16 10:55:35 IST 2025

-- Views in schema: public

DROP VIEW IF EXISTS public.permission_matrix CASCADE;
CREATE OR REPLACE VIEW public.permission_matrix AS
 SELECT r.name AS role_name,
    r.level AS role_level,
    p.resource_type::text AS resource,
    p.operation::text AS operation,
    p.scope_level AS scope,
    count(ur.user_id) AS users_with_permission
   FROM roles r
     JOIN role_permissions rp ON r.id = rp.role_id AND rp.is_active = true
     JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
     LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = true
  WHERE r.is_active = true AND p.is_active = true
  GROUP BY r.name, r.level, p.resource_type, p.operation, p.scope_level
  ORDER BY r.level DESC, p.resource_type, p.operation;

DROP VIEW IF EXISTS public.role_hierarchy CASCADE;
CREATE OR REPLACE VIEW public.role_hierarchy AS
 SELECT r.id,
    r.name,
    r.display_name,
    r.level,
    r.description,
    count(ur.user_id) AS user_count,
    count(rp.permission_id) AS permission_count,
    array_agg(DISTINCT p.resource_type::text) AS resources
   FROM roles r
     LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = true
     LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.is_active = true
     LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
  WHERE r.is_active = true
  GROUP BY r.id, r.name, r.display_name, r.level, r.description
  ORDER BY r.level DESC;

DROP VIEW IF EXISTS public.user_permissions_summary CASCADE;
CREATE OR REPLACE VIEW public.user_permissions_summary AS
 SELECT u.id AS user_id,
    u.email,
    u.full_name,
    u.status AS user_status,
    array_agg(DISTINCT r.name) AS roles,
    array_agg(DISTINCT p.name) AS permissions,
    array_agg(DISTINCT p.resource_type::text) AS resources,
    max(r.level) AS max_role_level,
    u.is_system_admin
   FROM users u
     LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
     LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
     LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.is_active = true
     LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
  WHERE u.deleted_at IS NULL
  GROUP BY u.id, u.email, u.full_name, u.status, u.is_system_admin;

DROP VIEW IF EXISTS public.v_student_current_enrollment CASCADE;
CREATE OR REPLACE VIEW public.v_student_current_enrollment AS
 WITH preferred AS (
         SELECT s.id AS student_id,
            se.id AS enrollment_id,
            se.enrollment_code,
            se.session_id,
            se.course_id,
            se.status,
            se.entry_year,
            1 AS priority
           FROM students s
             LEFT JOIN student_enrollments se ON se.id = s.current_enrollment_id
          WHERE s.current_enrollment_id IS NOT NULL
        ), fallback AS (
         SELECT s.id AS student_id,
            se.id AS enrollment_id,
            se.enrollment_code,
            se.session_id,
            se.course_id,
            se.status,
            se.entry_year,
            2 AS priority,
            row_number() OVER (PARTITION BY s.id ORDER BY se.enrollment_date DESC NULLS LAST, se.created_at DESC NULLS LAST) AS rn
           FROM students s
             JOIN student_enrollments se ON se.student_id = s.id AND se.status = 'active'::text
        )
 SELECT student_id,
    enrollment_id,
    enrollment_code,
    session_id,
    course_id,
    status,
    entry_year
   FROM ( SELECT u.student_id,
            u.enrollment_id,
            u.enrollment_code,
            u.session_id,
            u.course_id,
            u.status,
            u.entry_year,
            u.priority,
            row_number() OVER (PARTITION BY u.student_id ORDER BY u.priority) AS pick
           FROM ( SELECT preferred.student_id,
                    preferred.enrollment_id,
                    preferred.enrollment_code,
                    preferred.session_id,
                    preferred.course_id,
                    preferred.status,
                    preferred.entry_year,
                    preferred.priority
                   FROM preferred
                UNION ALL
                 SELECT fallback.student_id,
                    fallback.enrollment_id,
                    fallback.enrollment_code,
                    fallback.session_id,
                    fallback.course_id,
                    fallback.status,
                    fallback.entry_year,
                    fallback.priority
                   FROM fallback
                  WHERE fallback.rn = 1) u) ranked
  WHERE pick = 1;

DROP VIEW IF EXISTS public.view_fee_current_balances CASCADE;
CREATE OR REPLACE VIEW public.view_fee_current_balances AS
 SELECT fle.enrollment_id,
    fle.academic_year,
    fle.fee_component_id,
    fc.code AS fee_component_code,
    fc.label AS fee_component_label,
    sum(
        CASE
            WHEN fle.event_type = ANY (ARRAY['CHARGE_CREATED'::fee_ledger_event_type, 'PENALTY_APPLIED'::fee_ledger_event_type, 'CARRY_FORWARD_APPLIED'::fee_ledger_event_type]) THEN fle.amount
            WHEN fle.event_type = ANY (ARRAY['PAYMENT_RECEIVED'::fee_ledger_event_type, 'DISCOUNT_APPLIED'::fee_ledger_event_type]) THEN - fle.amount
            WHEN fle.event_type = ANY (ARRAY['CHARGE_CANCELLED'::fee_ledger_event_type, 'PAYMENT_CANCELLED'::fee_ledger_event_type]) THEN - fle.amount
            WHEN fle.event_type = 'REFUND_ISSUED'::fee_ledger_event_type THEN fle.amount
            ELSE 0::numeric
        END) AS current_balance,
    sum(
        CASE
            WHEN fle.event_type = ANY (ARRAY['CHARGE_CREATED'::fee_ledger_event_type, 'PENALTY_APPLIED'::fee_ledger_event_type, 'CARRY_FORWARD_APPLIED'::fee_ledger_event_type]) THEN fle.amount
            ELSE 0::numeric
        END) AS total_charges,
    sum(
        CASE
            WHEN fle.event_type = ANY (ARRAY['PAYMENT_RECEIVED'::fee_ledger_event_type, 'DISCOUNT_APPLIED'::fee_ledger_event_type]) THEN fle.amount
            ELSE 0::numeric
        END) AS total_payments,
    count(*) AS event_count,
    max(fle.event_date) AS last_activity_date
   FROM fee_ledger_events fle
     JOIN fee_components fc ON fle.fee_component_id = fc.id
  WHERE fle.deleted_at IS NULL
  GROUP BY fle.enrollment_id, fle.academic_year, fle.fee_component_id, fc.code, fc.label
 HAVING sum(
        CASE
            WHEN fle.event_type = ANY (ARRAY['CHARGE_CREATED'::fee_ledger_event_type, 'PENALTY_APPLIED'::fee_ledger_event_type, 'CARRY_FORWARD_APPLIED'::fee_ledger_event_type]) THEN fle.amount
            WHEN fle.event_type = ANY (ARRAY['PAYMENT_RECEIVED'::fee_ledger_event_type, 'DISCOUNT_APPLIED'::fee_ledger_event_type]) THEN - fle.amount
            WHEN fle.event_type = ANY (ARRAY['CHARGE_CANCELLED'::fee_ledger_event_type, 'PAYMENT_CANCELLED'::fee_ledger_event_type]) THEN - fle.amount
            WHEN fle.event_type = 'REFUND_ISSUED'::fee_ledger_event_type THEN fle.amount
            ELSE 0::numeric
        END) <> 0::numeric
  ORDER BY fle.enrollment_id, fle.academic_year, fc.code;

DROP VIEW IF EXISTS public.view_fee_receipt_details CASCADE;
CREATE OR REPLACE VIEW public.view_fee_receipt_details AS
 SELECT r.id AS receipt_id,
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
    fc.code AS fee_component_code,
    fc.label AS fee_component_label,
    a.allocated_amount,
    brr.charge_amount AS pre_payment_charge,
    brr.paid_amount AS pre_payment_paid,
    brr.balance_amount AS pre_payment_balance,
    r.created_at AS receipt_created_at
   FROM fee_receipts r
     LEFT JOIN fee_receipt_allocations a ON r.id = a.receipt_id
     LEFT JOIN fee_components fc ON a.fee_component_id = fc.id
     LEFT JOIN fee_receipt_balance_records brr ON r.id = brr.receipt_id AND a.fee_component_id = brr.fee_component_id
  WHERE r.deleted_at IS NULL
  ORDER BY r.receipt_date DESC, r.receipt_number, fc.code;

DROP VIEW IF EXISTS public.view_fee_year_summary CASCADE;
CREATE OR REPLACE VIEW public.view_fee_year_summary AS
 SELECT enrollment_id,
    academic_year,
    sum(
        CASE
            WHEN event_type = ANY (ARRAY['CHARGE_CREATED'::fee_ledger_event_type, 'PENALTY_APPLIED'::fee_ledger_event_type, 'CARRY_FORWARD_APPLIED'::fee_ledger_event_type]) THEN amount
            ELSE 0::numeric
        END) AS total_charges,
    sum(
        CASE
            WHEN event_type = ANY (ARRAY['PAYMENT_RECEIVED'::fee_ledger_event_type, 'DISCOUNT_APPLIED'::fee_ledger_event_type]) THEN amount
            ELSE 0::numeric
        END) AS total_payments,
    sum(
        CASE
            WHEN event_type = ANY (ARRAY['CHARGE_CREATED'::fee_ledger_event_type, 'PENALTY_APPLIED'::fee_ledger_event_type, 'CARRY_FORWARD_APPLIED'::fee_ledger_event_type]) THEN amount
            WHEN event_type = ANY (ARRAY['PAYMENT_RECEIVED'::fee_ledger_event_type, 'DISCOUNT_APPLIED'::fee_ledger_event_type]) THEN - amount
            WHEN event_type = ANY (ARRAY['CHARGE_CANCELLED'::fee_ledger_event_type, 'PAYMENT_CANCELLED'::fee_ledger_event_type]) THEN - amount
            WHEN event_type = 'REFUND_ISSUED'::fee_ledger_event_type THEN amount
            ELSE 0::numeric
        END) AS outstanding_balance,
    count(DISTINCT receipt_id) FILTER (WHERE receipt_id IS NOT NULL) AS receipt_count,
    min(event_date) AS first_activity,
    max(event_date) AS last_activity
   FROM fee_ledger_events
  WHERE deleted_at IS NULL
  GROUP BY enrollment_id, academic_year
  ORDER BY enrollment_id, academic_year;

