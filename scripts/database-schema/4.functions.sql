-- Database Functions Export
-- Generated on: Mon Sep 15 11:54:35 IST 2025

-- Functions from schema: public
-- Total functions: 40

-- Function: cancel_fee_payment
-- Type: function
-- Language: plpgsql
-- Arguments: p_receipt_id uuid, p_cancellation_reason text, p_cancelled_by uuid DEFAULT NULL::uuid
-- Return Type: void

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.cancel_fee_payment(p_receipt_id uuid, p_cancellation_reason text, p_cancelled_by uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enrollment_id UUID;
  v_total_amount NUMERIC(12,2);
  v_allocation RECORD;
  v_auth_user_id UUID;
BEGIN
  -- Security: Get authenticated user ID
  v_auth_user_id := auth.uid();
  
  -- Security: Validate user has permission to cancel payments
  IF NOT user_has_permission(v_auth_user_id, 'FEES', 'DELETE') THEN
    RAISE EXCEPTION 'Insufficient permissions to cancel payments';
  END IF;

  -- Input validation
  IF p_cancellation_reason IS NULL OR length(trim(p_cancellation_reason)) = 0 THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  -- Get receipt details
  SELECT enrollment_id, total_amount
  INTO v_enrollment_id, v_total_amount
  FROM fee_receipts
  WHERE id = p_receipt_id AND status = 'ACTIVE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active receipt not found with ID: %', p_receipt_id;
  END IF;

  -- Start transaction block
  BEGIN
    -- 1. Cancel the receipt
    UPDATE fee_receipts
    SET
      status = 'CANCELLED'::receipt_status_type,
      remarks = COALESCE(remarks, '') || ' | CANCELLED: ' || p_cancellation_reason,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = COALESCE(p_cancelled_by, v_auth_user_id)
    WHERE id = p_receipt_id;

    -- 2. Reverse any rebate adjustments associated with this payment
    -- Note: Rebates are typically created during payment processing with the receipt date
    -- We identify them by matching enrollment_id, effective_date, and status
    UPDATE fee_adjustments
    SET
      status = 'CANCELLED'::fee_adjustment_status,
      reason = COALESCE(reason, '') || ' | CANCELLED due to payment cancellation: ' || p_cancellation_reason,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = COALESCE(p_cancelled_by, v_auth_user_id)
    WHERE enrollment_id = v_enrollment_id
      AND adjustment_type = 'DISCOUNT'
      AND status = 'ACTIVE'
      AND effective_date = (SELECT receipt_date FROM fee_receipts WHERE id = p_receipt_id)
      AND title LIKE 'Payment Rebate:%';

    -- 3. Reverse rebate impact on current balances
    -- Get rebate adjustments that were just cancelled to reverse their impact
    FOR v_allocation IN
      SELECT 
        fa.fee_component_id,
        fa.amount as rebate_amount
      FROM fee_adjustments fa
      WHERE fa.enrollment_id = v_enrollment_id
        AND fa.adjustment_type = 'DISCOUNT'
        AND fa.status = 'CANCELLED'
        AND fa.effective_date = (SELECT receipt_date FROM fee_receipts WHERE id = p_receipt_id)
        AND fa.title LIKE 'Payment Rebate:%'
        AND fa.updated_at = CURRENT_TIMESTAMP -- Just updated above
    LOOP
      -- Reverse rebate impact on balances
      UPDATE fee_current_balances
      SET
        discount_amount = GREATEST(0, COALESCE(discount_amount, 0) - v_allocation.rebate_amount),
        charged_amount = COALESCE(charged_amount, 0) + v_allocation.rebate_amount,
        outstanding_amount = COALESCE(outstanding_amount, 0) + v_allocation.rebate_amount,
        last_updated_at = CURRENT_TIMESTAMP,
        last_updated_by = COALESCE(p_cancelled_by, v_auth_user_id)
      WHERE enrollment_id = v_enrollment_id
        AND fee_component_id = v_allocation.fee_component_id;

      -- Create ledger event for rebate reversal
      INSERT INTO fee_ledger_events (
        event_type,
        enrollment_id,
        academic_year,
        fee_component_id,
        amount,
        running_balance,
        receipt_id,
        description,
        created_by,
        created_at
      ) VALUES (
        'ADJUSTMENT_MADE'::fee_ledger_event_type,
        v_enrollment_id,
        (SELECT academic_year FROM fee_receipts WHERE id = p_receipt_id),
        v_allocation.fee_component_id,
        v_allocation.rebate_amount, -- Positive amount to reverse the discount
        0, -- Will be calculated by trigger
        p_receipt_id,
        'Rebate cancelled due to payment cancellation: ' || p_cancellation_reason,
        COALESCE(p_cancelled_by, v_auth_user_id),
        CURRENT_TIMESTAMP
      );
    END LOOP;

    -- 4. Reverse payment allocations and update balances
    FOR v_allocation IN
      SELECT fee_component_id, allocated_amount
      FROM fee_receipt_allocations
      WHERE receipt_id = p_receipt_id
    LOOP
      -- Reverse balance updates
      UPDATE fee_current_balances
      SET
        paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - v_allocation.allocated_amount),
        outstanding_amount = COALESCE(outstanding_amount, 0) + v_allocation.allocated_amount,
        last_updated_at = CURRENT_TIMESTAMP,
        last_updated_by = COALESCE(p_cancelled_by, v_auth_user_id)
      WHERE enrollment_id = v_enrollment_id
        AND fee_component_id = v_allocation.fee_component_id;
    END LOOP;

    -- 5. Create cancellation ledger events for payment allocations
    INSERT INTO fee_ledger_events (
      event_type,
      enrollment_id,
      academic_year,
      fee_component_id,
      amount,
      running_balance,
      receipt_id,
      description,
      created_by,
      created_at
    )
    SELECT
      'PAYMENT_CANCELLED'::fee_ledger_event_type,
      v_enrollment_id,
      fr.academic_year,
      fra.fee_component_id,
      -fra.allocated_amount,
      0, -- Will be calculated by trigger
      p_receipt_id,
      'Payment cancelled: ' || p_cancellation_reason,
      COALESCE(p_cancelled_by, v_auth_user_id),
      CURRENT_TIMESTAMP
    FROM fee_receipt_allocations fra
    JOIN fee_receipts fr ON fr.id = fra.receipt_id
    WHERE fra.receipt_id = p_receipt_id;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Payment cancellation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
END;
$function$


-- Function: fn_issue_enrollment
-- Type: function
-- Language: plpgsql
-- Arguments: p_applicant_name text, p_college_id uuid, p_course_id uuid, p_session_id uuid, p_agent_id uuid DEFAULT NULL::uuid, p_student_id uuid DEFAULT NULL::uuid, p_entry_type text DEFAULT 'regular'::text, p_joining_date date DEFAULT NULL::date
-- Return Type: record
CREATE OR REPLACE FUNCTION public.fn_issue_enrollment(p_applicant_name text, p_college_id uuid, p_course_id uuid, p_session_id uuid, p_agent_id uuid DEFAULT NULL::uuid, p_student_id uuid DEFAULT NULL::uuid, p_entry_type text DEFAULT 'regular'::text, p_joining_date date DEFAULT NULL::date)
 RETURNS TABLE(enrollment_id uuid, enrollment_code text, student_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user uuid := auth.uid();
  v_session record;
  v_college record;
  v_next_number int;
  v_first_year int;
  v_student_id uuid;
  v_enrollment_id uuid;
  v_enrollment_code text;
  v_college_code text;
BEGIN
  -- permission check (falls back to TRUE if stub returns authenticated)
  IF NOT user_has_permission(v_auth_user, 'ADMISSIONS', 'CREATE') THEN
    RAISE EXCEPTION 'Insufficient permissions to confirm admissions';
  END IF;
  
  -- load session and college
  SELECT * INTO v_session FROM academic_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found: %', p_session_id; END IF;
  SELECT * INTO v_college FROM colleges WHERE id = p_college_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'College not found: %', p_college_id; END IF;
  v_college_code := v_college.code;

  -- compute first year of session
  v_first_year := COALESCE(date_part('year', v_session.start_date)::int,
                           NULLIF(split_part(v_session.title, '-', 1), '')::int);
  IF v_first_year IS NULL THEN
    v_first_year := date_part('year', current_date)::int;
  END IF;

  -- atomically reserve and get issued number (pre-increment value)
  UPDATE colleges
  SET admission_number = admission_number + 1
  WHERE id = p_college_id
  RETURNING admission_number - 1 INTO v_next_number;

  IF v_next_number IS NULL THEN
    RAISE EXCEPTION 'Failed to reserve admission number for college %', p_college_id;
  END IF;

  -- build enrollment code: college_code/admission_number/firstYear
  v_enrollment_code := COALESCE(NULLIF(trim(v_college_code), ''), 'COL') || '/' || v_next_number::text || '/' || v_first_year::text;

  -- create or reuse student
  IF p_student_id IS NOT NULL THEN
    v_student_id := p_student_id;
  ELSE
    INSERT INTO students (full_name, status, created_at, updated_at, updated_by)
    VALUES (p_applicant_name, 'active', now(), now(), v_auth_user)
    RETURNING id INTO v_student_id;
  END IF;

  -- create enrollment
  INSERT INTO student_enrollments (
    student_id, course_id, session_id, enrollment_code, enrollment_date, joining_date,
    entry_year, entry_type, agent_id, fee_plan_id, status, created_at, updated_at, updated_by
  ) VALUES (
    v_student_id, p_course_id, p_session_id, v_enrollment_code, current_date, p_joining_date,
    v_first_year::smallint, p_entry_type, p_agent_id, NULL, 'active', now(), now(), v_auth_user
  ) RETURNING id INTO v_enrollment_id;

  -- set current enrollment on student
  UPDATE students SET current_enrollment_id = v_enrollment_id, updated_at = now(), updated_by = v_auth_user
  WHERE id = v_student_id;

  -- return
  enrollment_id := v_enrollment_id;
  enrollment_code := v_enrollment_code;
  student_id := v_student_id;
  RETURN NEXT;
  RETURN;
END;
$function$


-- Function: get_fee_payment_summary
-- Type: function
-- Language: plpgsql
-- Arguments: p_enrollment_id uuid
-- Return Type: jsonb
CREATE OR REPLACE FUNCTION public.get_fee_payment_summary(p_enrollment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
  v_auth_user_id UUID;
BEGIN
  -- Security: Get authenticated user ID
  v_auth_user_id := auth.uid();
  
  -- Security: Validate user has permission to view fee summaries
  IF NOT user_has_permission(v_auth_user_id, 'FEES', 'READ') THEN
    RAISE EXCEPTION 'Insufficient permissions to view fee summaries';
  END IF;

  -- Input validation
  IF p_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment ID is required';
  END IF;

  SELECT jsonb_build_object(
    'total_paid', COALESCE(SUM(fcb.paid_amount), 0),
    'total_outstanding', COALESCE(SUM(fcb.outstanding_amount), 0),
    'total_charged', COALESCE(SUM(fcb.charged_amount), 0),
    'total_discount', COALESCE(SUM(fcb.discount_amount), 0),
    'last_payment_date', MAX(fr.receipt_date),
    'payment_count', COUNT(DISTINCT fr.id),
    'enrollment_id', p_enrollment_id,
    'summary_date', CURRENT_TIMESTAMP
  )
  INTO v_result
  FROM fee_current_balances fcb
  LEFT JOIN fee_receipts fr ON fr.enrollment_id = fcb.enrollment_id
    AND fr.status = 'ACTIVE'
  WHERE fcb.enrollment_id = p_enrollment_id
    AND fcb.deleted_at IS NULL;

  RETURN COALESCE(v_result, jsonb_build_object(
    'total_paid', 0,
    'total_outstanding', 0,
    'total_charged', 0,
    'total_discount', 0,
    'last_payment_date', null,
    'payment_count', 0,
    'enrollment_id', p_enrollment_id,
    'summary_date', CURRENT_TIMESTAMP
  ));
END;
$function$


-- Function: gin_extract_query_trgm
-- Type: function
-- Language: c
-- Arguments: text, internal, smallint, internal, internal, internal, internal
-- Return Type: internal
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gin_extract_value_trgm
-- Type: function
-- Language: c
-- Arguments: text, internal
-- Return Type: internal
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gin_trgm_consistent
-- Type: function
-- Language: c
-- Arguments: internal, smallint, text, integer, internal, internal, internal, internal
-- Return Type: boolean
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gin_trgm_triconsistent
-- Type: function
-- Language: c
-- Arguments: internal, smallint, text, integer, internal, internal, internal
-- Return Type: "char"
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_compress
-- Type: function
-- Language: c
-- Arguments: internal
-- Return Type: internal
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_consistent
-- Type: function
-- Language: c
-- Arguments: internal, text, smallint, oid, internal
-- Return Type: boolean
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_decompress
-- Type: function
-- Language: c
-- Arguments: internal
-- Return Type: internal
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_distance
-- Type: function
-- Language: c
-- Arguments: internal, text, smallint, oid, internal
-- Return Type: double precision
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_in
-- Type: function
-- Language: c
-- Arguments: cstring
-- Return Type: gtrgm
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_options
-- Type: function
-- Language: c
-- Arguments: internal
-- Return Type: void
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_out
-- Type: function
-- Language: c
-- Arguments: gtrgm
-- Return Type: cstring
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_penalty
-- Type: function
-- Language: c
-- Arguments: internal, internal, internal
-- Return Type: internal
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_picksplit
-- Type: function
-- Language: c
-- Arguments: internal, internal
-- Return Type: internal
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_same
-- Type: function
-- Language: c
-- Arguments: gtrgm, gtrgm, internal
-- Return Type: internal
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: gtrgm_union
-- Type: function
-- Language: c
-- Arguments: internal, internal
-- Return Type: gtrgm
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: handle_new_user
-- Type: function
-- Language: plpgsql
-- Arguments: 
-- Return Type: trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    new_user_id UUID;
    user_count INTEGER;
    super_admin_role_id UUID;
    is_first_user BOOLEAN DEFAULT FALSE;
BEGIN
    -- Check current user count in public.users (excluding deleted users)
    SELECT COUNT(*) INTO user_count 
    FROM public.users 
    WHERE deleted_at IS NULL;
    
    -- Determine if this is the first user
    is_first_user := (user_count = 0);
    
    RAISE NOTICE 'Processing new user: %, Current user count: %, Is first user: %', 
                 NEW.email, user_count, is_first_user;
    
    -- For now, just create the user (we'll add invitation logic later)
    INSERT INTO public.users (
        supabase_auth_id,
        email,
        first_name,
        last_name,
        status
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            CASE 
                WHEN length(TRIM(NEW.raw_user_meta_data->>'first_name')) >= 2 
                THEN TRIM(NEW.raw_user_meta_data->>'first_name')
                ELSE NULL
            END,
            CASE 
                WHEN length(split_part(NEW.email, '@', 1)) >= 2 
                THEN split_part(NEW.email, '@', 1)
                ELSE 'User'
            END
        ),
        COALESCE(
            CASE 
                WHEN length(TRIM(NEW.raw_user_meta_data->>'last_name')) >= 2 
                THEN TRIM(NEW.raw_user_meta_data->>'last_name')
                ELSE NULL
            END,
            'Account'
        ),
        'ACTIVE'
    ) RETURNING id INTO new_user_id;
    
    RAISE NOTICE 'Created public.users record % for %', new_user_id, NEW.email;
    
    -- If first user, make them super admin
    IF is_first_user THEN
        BEGIN
            SELECT id INTO super_admin_role_id 
            FROM public.roles 
            WHERE name = 'SUPER_ADMIN' 
              AND is_active = TRUE;
            
            IF super_admin_role_id IS NOT NULL THEN
                -- Make user system admin
                UPDATE public.users 
                SET is_system_admin = TRUE
                WHERE id = new_user_id;
                
                -- Assign SUPER_ADMIN role
                INSERT INTO public.user_roles (
                    user_id, 
                    role_id, 
                    assigned_by, 
                    assigned_at,
                    is_active
                ) VALUES (
                    new_user_id, 
                    super_admin_role_id, 
                    new_user_id,
                    CURRENT_TIMESTAMP,
                    TRUE
                );
                
                RAISE NOTICE 'First user % automatically assigned as Super Admin', NEW.email;
            ELSE
                -- Just make them system admin if role doesn't exist
                UPDATE public.users 
                SET is_system_admin = TRUE
                WHERE id = new_user_id;
                
                RAISE NOTICE 'First user % made system admin (SUPER_ADMIN role not found)', NEW.email;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- If any error, just make them system admin
                UPDATE public.users 
                SET is_system_admin = TRUE
                WHERE id = new_user_id;
                
                RAISE NOTICE 'First user % made system admin (role assignment failed: %)', NEW.email, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$function$


-- Function: process_fee_payment
-- Type: function
-- Language: plpgsql
-- Arguments: p_student_id uuid, p_enrollment_id uuid, p_receipt_number text, p_receipt_date date, p_academic_year text, p_payment_method text, p_total_amount numeric, p_component_payments jsonb, p_current_year integer, p_remarks text DEFAULT NULL::text, p_rebate_amount numeric DEFAULT 0, p_rebate_reason text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid
-- Return Type: jsonb
CREATE OR REPLACE FUNCTION public.process_fee_payment(p_student_id uuid, p_enrollment_id uuid, p_receipt_number text, p_receipt_date date, p_academic_year text, p_payment_method text, p_total_amount numeric, p_component_payments jsonb, p_current_year integer, p_remarks text DEFAULT NULL::text, p_rebate_amount numeric DEFAULT 0, p_rebate_reason text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_receipt_id UUID;
  v_component_key TEXT;
  v_payment_amount NUMERIC(12,2);
  v_fee_component_id UUID;
  v_allocations_created INTEGER := 0;
  v_ledger_events_created INTEGER := 0;
  v_balances_updated INTEGER := 0;
  v_rebate_adjustment_id UUID;
  v_auth_user_id UUID;
  v_academic_year_short TEXT;
BEGIN
  -- Convert academic year to YYYY-YY format if needed
  IF p_academic_year ~ '^\d{4}-\d{4}$' THEN
    -- Convert from YYYY-YYYY to YYYY-YY format
    v_academic_year_short := left(p_academic_year, 4) || '-' || right(p_academic_year, 2);
  ELSE
    v_academic_year_short := p_academic_year;
  END IF;
  -- Security: Get authenticated user ID
  v_auth_user_id := auth.uid();
  
  -- Security: Validate user has permission to process payments
  IF NOT user_has_permission(v_auth_user_id, 'FEES', 'CREATE') THEN
    RAISE EXCEPTION 'Insufficient permissions to process payments';
  END IF;

  -- Input validation
  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  
  IF p_receipt_number IS NULL OR length(trim(p_receipt_number)) = 0 THEN
    RAISE EXCEPTION 'Receipt number is required';
  END IF;
  
  IF p_rebate_amount > 0 AND (p_rebate_reason IS NULL OR length(trim(p_rebate_reason)) = 0) THEN
    RAISE EXCEPTION 'Rebate reason is required when rebate amount > 0';
  END IF;

  -- Check for duplicate receipt number
  IF EXISTS (
    SELECT 1 FROM fee_receipts 
    WHERE receipt_number = p_receipt_number 
    AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Receipt number already exists: %', p_receipt_number;
  END IF;

  -- Start transaction block
  BEGIN
    -- 1. Create the main receipt record
    INSERT INTO fee_receipts (
      enrollment_id,
      receipt_number,
      receipt_date,
      total_amount,
      paid_amount,
      balance_amount,
      payment_method,
      academic_year,
      remarks,
      status,
      created_by,
      created_at
    ) VALUES (
      p_enrollment_id,
      p_receipt_number,
      p_receipt_date,
      p_total_amount,
      p_total_amount,
      0,
      p_payment_method::payment_method_type,
      v_academic_year_short,
      p_remarks,
      'ACTIVE'::receipt_status_type,
      COALESCE(p_created_by, v_auth_user_id),
      CURRENT_TIMESTAMP
    )
    RETURNING id INTO v_receipt_id;

    -- 2. Handle rebate if provided
    IF p_rebate_amount > 0 AND p_rebate_reason IS NOT NULL THEN
      -- Find tuition component
      SELECT id INTO v_fee_component_id
      FROM fee_components
      WHERE code = 'TUITION'
      LIMIT 1;

      IF v_fee_component_id IS NOT NULL THEN
        -- Create rebate adjustment
        INSERT INTO fee_adjustments (
          enrollment_id,
          academic_year,
          fee_component_id,
          adjustment_type,
          amount,
          title,
          reason,
          status,
          effective_date,
          created_by,
          created_at
        ) VALUES (
          p_enrollment_id,
          v_academic_year_short,
          v_fee_component_id,
          'DISCOUNT'::fee_adjustment_type,
          p_rebate_amount,
          'Payment Rebate: ' || p_rebate_reason,
          p_rebate_reason,
          'ACTIVE'::fee_adjustment_status,
          p_receipt_date,
          COALESCE(p_created_by, v_auth_user_id),
          CURRENT_TIMESTAMP
        )
        RETURNING id INTO v_rebate_adjustment_id;

        -- Create ledger event for rebate
        INSERT INTO fee_ledger_events (
          event_type,
          enrollment_id,
          academic_year,
          fee_component_id,
          amount,
          running_balance,
          description,
          created_by,
          created_at
        ) VALUES (
          'DISCOUNT_APPLIED'::fee_ledger_event_type,
          p_enrollment_id,
          v_academic_year_short,
          v_fee_component_id,
          -p_rebate_amount,
          0, -- Will be calculated by trigger
          'Rebate: ' || p_rebate_reason,
          COALESCE(p_created_by, v_auth_user_id),
          CURRENT_TIMESTAMP
        );

        -- Update current balances for rebate
        UPDATE fee_current_balances
        SET
          discount_amount = COALESCE(discount_amount, 0) + p_rebate_amount,
          charged_amount = GREATEST(0, charged_amount - p_rebate_amount),
          outstanding_amount = GREATEST(0, outstanding_amount - p_rebate_amount),
          last_updated_at = CURRENT_TIMESTAMP,
          last_updated_by = COALESCE(p_created_by, v_auth_user_id)
        WHERE enrollment_id = p_enrollment_id
          AND fee_component_id = v_fee_component_id;
      END IF;
    END IF;

    -- 3. Process component payments
    FOR v_component_key, v_payment_amount IN
      SELECT key, value::numeric
      FROM jsonb_each_text(p_component_payments)
      WHERE value::numeric > 0
    LOOP
      v_fee_component_id := NULL;

      -- Find fee component by code (no need for plan items)
      SELECT id INTO v_fee_component_id
      FROM fee_components
      WHERE code = v_component_key
      LIMIT 1;
      
      RAISE WARNING 'Looking for component: %, found ID: %', v_component_key, v_fee_component_id;

      -- Create allocation record if component found
      IF v_fee_component_id IS NOT NULL THEN
        DECLARE
          v_ledger_event_id UUID;
        BEGIN
          -- Create ledger event for payment first
          INSERT INTO fee_ledger_events (
            event_type,
            enrollment_id,
            academic_year,
            fee_component_id,
            amount,
            running_balance,
            receipt_id,
            description,
            created_by,
            created_at
          ) VALUES (
            'PAYMENT_RECEIVED'::fee_ledger_event_type,
            p_enrollment_id,
            v_academic_year_short,
            v_fee_component_id,
            v_payment_amount,
            0, -- Will be calculated by trigger
            v_receipt_id,
            'Payment allocation: ' || v_component_key,
            COALESCE(p_created_by, v_auth_user_id),
            CURRENT_TIMESTAMP
          )
          RETURNING id INTO v_ledger_event_id;

          v_ledger_events_created := v_ledger_events_created + 1;

          -- Now create allocation record with ledger event reference
          INSERT INTO fee_receipt_allocations (
            receipt_id,
            ledger_event_id,
            fee_component_id,
            allocated_amount,
            enrollment_id,
            academic_year,
            receipt_date
          ) VALUES (
            v_receipt_id,
            v_ledger_event_id,
            v_fee_component_id,
            v_payment_amount,
            p_enrollment_id,
            v_academic_year_short,
            p_receipt_date
          );

          v_allocations_created := v_allocations_created + 1;

          -- Update current balances
          UPDATE fee_current_balances
          SET
            paid_amount = COALESCE(paid_amount, 0) + v_payment_amount,
            outstanding_amount = GREATEST(0, COALESCE(outstanding_amount, 0) - v_payment_amount),
            last_updated_at = CURRENT_TIMESTAMP,
            last_updated_by = COALESCE(p_created_by, v_auth_user_id)
          WHERE enrollment_id = p_enrollment_id
            AND fee_component_id = v_fee_component_id;

          GET DIAGNOSTICS v_balances_updated = ROW_COUNT;
          IF v_balances_updated = 0 THEN
            -- Create new balance record if none exists
            INSERT INTO fee_current_balances (
              enrollment_id,
              fee_component_id,
              academic_year,
              charged_amount,
              paid_amount,
              outstanding_amount,
              last_updated_at,
              last_updated_by
            ) VALUES (
              p_enrollment_id,
              v_fee_component_id,
              v_academic_year_short,
              0,
              v_payment_amount,
              0,
              CURRENT_TIMESTAMP,
              COALESCE(p_created_by, v_auth_user_id)
            );
            v_balances_updated := v_balances_updated + 1;
          END IF;
        END;
      ELSE
        RAISE WARNING 'Fee component not found for key: %', v_component_key;
      END IF;
    END LOOP;

    -- 4. Create balance records for receipt history (only for relevant components)
    -- Show components where: balance > 0 OR (paid > 0 AND balance = 0)
    -- Balance snapshot must satisfy constraint: balance_amount = charge_amount - paid_amount
    INSERT INTO fee_receipt_balance_records (
      receipt_id,
      fee_component_id,
      charge_amount,
      paid_amount,
      balance_amount,
      enrollment_id,
      academic_year,
      receipt_date,
      created_at
    )
    SELECT 
      v_receipt_id,
      fcb.fee_component_id,
      fcb.charged_amount,
      fcb.paid_amount,
      (fcb.charged_amount - fcb.paid_amount) AS balance_amount,
      fcb.enrollment_id,
      v_academic_year_short,
      p_receipt_date,
      CURRENT_TIMESTAMP
    FROM fee_current_balances fcb
    WHERE fcb.enrollment_id = p_enrollment_id
      AND fcb.deleted_at IS NULL
      AND (
        (fcb.charged_amount - fcb.paid_amount) > 0 OR 
        (fcb.paid_amount > 0 AND (fcb.charged_amount - fcb.paid_amount) = 0)
      );

    -- Return success result
    RETURN jsonb_build_object(
      'success', true,
      'receipt_id', v_receipt_id,
      'receipt_number', p_receipt_number,
      'allocations_created', v_allocations_created,
      'ledger_events_created', v_ledger_events_created,
      'balances_updated', v_balances_updated,
      'message', 'Payment processed successfully'
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Log error for debugging
      RAISE EXCEPTION 'Payment processing failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
END;
$function$


-- Function: rpc_students_grid_live
-- Type: function
-- Language: sql
-- Arguments: p_q text DEFAULT NULL::text, p_college_id uuid DEFAULT NULL::uuid, p_course_id uuid DEFAULT NULL::uuid, p_session_id uuid DEFAULT NULL::uuid, p_current_year integer DEFAULT NULL::integer, p_sort text DEFAULT 'full_name'::text, p_order text DEFAULT 'asc'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0
-- Return Type: record
CREATE OR REPLACE FUNCTION public.rpc_students_grid_live(p_q text DEFAULT NULL::text, p_college_id uuid DEFAULT NULL::uuid, p_course_id uuid DEFAULT NULL::uuid, p_session_id uuid DEFAULT NULL::uuid, p_current_year integer DEFAULT NULL::integer, p_sort text DEFAULT 'full_name'::text, p_order text DEFAULT 'asc'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(student_id uuid, full_name text, enrollment_id uuid, enrollment_code text, father_name text, mother_name text, session_id uuid, session_title text, current_year integer, course_id uuid, course_name text, course_duration integer, college_id uuid, college_name text, college_code text, previous_balance numeric, current_due numeric, total_outstanding numeric, last_payment_date date, last_payment_amount numeric)
 LANGUAGE sql
 STABLE
AS $function$
  WITH ce AS (
    SELECT * FROM v_student_current_enrollment
  ), sp AS (
    SELECT enrollment_id, to_year, course_duration
    FROM (
      SELECT 
        enrollment_id,
        to_year,
        course_duration,
        ROW_NUMBER() OVER (PARTITION BY enrollment_id ORDER BY effective_date DESC NULLS LAST, created_at DESC NULLS LAST) AS rn
      FROM student_progressions
    ) t WHERE rn = 1
  ), j AS (
    SELECT 
      s.id AS student_id,
      s.full_name,
      s.status AS student_status,
      p.father_name,
      p.mother_name,
      ce.enrollment_id,
      ce.enrollment_code,
      ce.status AS enrollment_status,
      ce.session_id,
      se.title AS session_title,
      ce.course_id,
      c.name AS course_name,
      COALESCE(c.duration, sp.course_duration) AS course_duration,
      c.college_id,
  col.name AS college_name,
  col.code AS college_code,
      COALESCE(sp.to_year, ce.entry_year, 1) AS current_year
    FROM ce
    JOIN students s ON s.id = ce.student_id
    LEFT JOIN student_profiles p ON p.student_id = s.id
    LEFT JOIN academic_sessions se ON se.id = ce.session_id
    LEFT JOIN courses c ON c.id = ce.course_id
    LEFT JOIN colleges col ON col.id = c.college_id
    LEFT JOIN sp ON sp.enrollment_id = ce.enrollment_id
    WHERE (p_q IS NULL OR s.full_name ILIKE '%' || p_q || '%' OR ce.enrollment_code ILIKE '%' || p_q || '%')
      AND (p_college_id IS NULL OR c.college_id = p_college_id)
      AND (p_course_id IS NULL OR c.id = p_course_id)
      AND (p_session_id IS NULL OR ce.session_id = p_session_id)
      AND (p_current_year IS NULL OR COALESCE(sp.to_year, ce.entry_year, 1) = p_current_year)
  )
  SELECT 
    j.student_id,
    j.full_name,
    j.enrollment_id,
    j.enrollment_code,
    j.father_name,
    j.mother_name,
    j.session_id,
    j.session_title,
    j.current_year,
    j.course_id,
    j.course_name,
    j.course_duration,
  j.college_id,
  j.college_name,
  j.college_code,
  COALESCE(fy.prev_balance, 0)::numeric(12,2) AS previous_balance,
  COALESCE(fy.current_due, 0)::numeric(12,2) AS current_due,
  (COALESCE(fy.prev_balance, 0) + COALESCE(fy.current_due, 0))::numeric(12,2) AS total_outstanding,
    lp.last_payment_date,
    lp.last_payment_amount
  FROM j
  LEFT JOIN LATERAL (
    SELECT 
      v.outstanding_balance AS current_due,
      (COALESCE(SUM(v.outstanding_balance) OVER (), 0) - COALESCE(v.outstanding_balance, 0)) AS prev_balance
    FROM view_fee_year_summary v
    WHERE v.enrollment_id = j.enrollment_id
    ORDER BY v.last_activity DESC NULLS LAST, v.academic_year DESC
    LIMIT 1
  ) fy ON true
  LEFT JOIN LATERAL (
    SELECT r.receipt_date AS last_payment_date, r.paid_amount AS last_payment_amount
    FROM fee_receipts r
    WHERE r.enrollment_id = j.enrollment_id AND r.deleted_at IS NULL AND r.status = 'ACTIVE'
    ORDER BY r.receipt_date DESC, r.created_at DESC
    LIMIT 1
  ) lp ON true
  ORDER BY 
    CASE WHEN p_sort = 'full_name' AND p_order = 'asc' THEN j.full_name END ASC,
    CASE WHEN p_sort = 'full_name' AND p_order = 'desc' THEN j.full_name END DESC,
    CASE WHEN p_sort = 'total_outstanding' AND p_order = 'asc' THEN (COALESCE(fy.prev_balance, 0) + COALESCE(fy.current_due, 0)) END ASC,
    CASE WHEN p_sort = 'total_outstanding' AND p_order = 'desc' THEN (COALESCE(fy.prev_balance, 0) + COALESCE(fy.current_due, 0)) END DESC,
    CASE WHEN p_sort = 'current_due' AND p_order = 'asc' THEN COALESCE(fy.current_due, 0) END ASC,
    CASE WHEN p_sort = 'current_due' AND p_order = 'desc' THEN COALESCE(fy.current_due, 0) END DESC,
    j.full_name ASC, j.enrollment_id ASC
  LIMIT p_limit OFFSET p_offset;
$function$


-- Function: set_limit
-- Type: function
-- Language: c
-- Arguments: real
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: show_limit
-- Type: function
-- Language: c
-- Arguments: 
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: show_trgm
-- Type: function
-- Language: c
-- Arguments: text
-- Return Type: text[]
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: similarity
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: similarity_dist
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: similarity_op
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: boolean
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: strict_word_similarity
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: strict_word_similarity_commutator_op
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: boolean
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: strict_word_similarity_dist_commutator_op
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: strict_word_similarity_dist_op
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: strict_word_similarity_op
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: boolean
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: update_fee_payment
-- Type: function
-- Language: plpgsql
-- Arguments: p_receipt_id uuid, p_enrollment_id uuid, p_receipt_number text, p_receipt_date date, p_academic_year text, p_payment_method text, p_total_amount numeric, p_component_payments jsonb, p_rebate_amount numeric DEFAULT 0, p_rebate_reason text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid
-- Return Type: jsonb
CREATE OR REPLACE FUNCTION public.update_fee_payment(p_receipt_id uuid, p_enrollment_id uuid, p_receipt_number text, p_receipt_date date, p_academic_year text, p_payment_method text, p_total_amount numeric, p_component_payments jsonb, p_rebate_amount numeric DEFAULT 0, p_rebate_reason text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user_id UUID;
  -- Only required fields from existing receipt
  v_existing_receipt_date DATE;
  v_alloc RECORD;
  v_old_rebate RECORD;
  v_fee_component_id UUID;
  v_component_key TEXT;
  v_payment_amount NUMERIC(12,2);
  v_allocations_created INTEGER := 0;
  v_ledger_events_created INTEGER := 0;
  v_balances_updated INTEGER := 0;
  v_academic_year_short TEXT;
  v_rebate_adjustment_id UUID;
  v_rows INTEGER := 0;
BEGIN
  -- Security & permission
  v_auth_user_id := auth.uid();
  IF NOT user_has_permission(v_auth_user_id, 'FEES', 'UPDATE') THEN
    RAISE EXCEPTION 'Insufficient permissions to update payments';
  END IF;

  -- Normalize academic year to YYYY-YY if needed
  IF p_academic_year ~ '^\d{4}-\d{4}$' THEN
    v_academic_year_short := left(p_academic_year, 4) || '-' || right(p_academic_year, 2);
  ELSE
    v_academic_year_short := p_academic_year;
  END IF;

  -- Fetch and validate existing receipt (lock row to prevent race conditions during edit)
  SELECT receipt_date INTO v_existing_receipt_date
  FROM fee_receipts
  WHERE id = p_receipt_id
    AND enrollment_id = p_enrollment_id
    AND status = 'ACTIVE'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active receipt not found for id %', p_receipt_id;
  END IF;

  -- Basic validation
  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero';
  END IF;
  IF p_receipt_number IS NULL OR length(trim(p_receipt_number)) = 0 THEN
    RAISE EXCEPTION 'Receipt number is required';
  END IF;
  IF p_rebate_amount > 0 AND (p_rebate_reason IS NULL OR length(trim(p_rebate_reason)) = 0) THEN
    RAISE EXCEPTION 'Rebate reason required when rebate amount > 0';
  END IF;

  -- Duplicate receipt number check (exclude current receipt)
  IF EXISTS (
    SELECT 1 FROM fee_receipts fr
    WHERE fr.receipt_number = p_receipt_number
      AND fr.status = 'ACTIVE'
      AND fr.id <> p_receipt_id
  ) THEN
    RAISE EXCEPTION 'Receipt number already exists: %', p_receipt_number;
  END IF;

  -- Validate component payment sum matches total
  IF (
    SELECT COALESCE(SUM( (value)::numeric ),0)
    FROM jsonb_each_text(p_component_payments)
    WHERE (value)::numeric > 0
  ) <> p_total_amount THEN
    RAISE EXCEPTION 'Component allocation total must equal payment total';
  END IF;

  -- Begin transactional work
  BEGIN
    -- 1. Reverse existing allocations impact on balances & remove allocations + ledger events
    FOR v_alloc IN
      SELECT fra.id, fra.fee_component_id, fra.allocated_amount, fra.ledger_event_id
      FROM fee_receipt_allocations fra
      WHERE fra.receipt_id = p_receipt_id
    LOOP
      -- Reverse balances
      UPDATE fee_current_balances
      SET
        paid_amount = GREATEST(0, COALESCE(paid_amount,0) - v_alloc.allocated_amount),
        outstanding_amount = COALESCE(outstanding_amount,0) + v_alloc.allocated_amount,
        last_updated_at = CURRENT_TIMESTAMP,
        last_updated_by = COALESCE(p_created_by, v_auth_user_id)
      WHERE enrollment_id = p_enrollment_id
        AND fee_component_id = v_alloc.fee_component_id;

      -- Delete allocation
      DELETE FROM fee_receipt_allocations WHERE id = v_alloc.id;
      -- Delete original payment ledger event
      DELETE FROM fee_ledger_events WHERE id = v_alloc.ledger_event_id;
    END LOOP;

    -- 2. Reverse existing rebate created during original processing (if any)
  FOR v_old_rebate IN
      SELECT fa.*
      FROM fee_adjustments fa
      WHERE fa.enrollment_id = p_enrollment_id
        AND fa.adjustment_type = 'DISCOUNT'
        AND fa.status = 'ACTIVE'
    AND fa.title LIKE 'Payment Rebate:%'
    AND fa.effective_date = v_existing_receipt_date
    LOOP
      -- Reverse balance impact
      UPDATE fee_current_balances fcb
      SET
        discount_amount = GREATEST(0, COALESCE(discount_amount,0) - v_old_rebate.amount),
        charged_amount = COALESCE(charged_amount,0) + v_old_rebate.amount,
        outstanding_amount = COALESCE(outstanding_amount,0) + v_old_rebate.amount,
        last_updated_at = CURRENT_TIMESTAMP,
        last_updated_by = COALESCE(p_created_by, v_auth_user_id)
      WHERE fcb.enrollment_id = p_enrollment_id
        AND fcb.fee_component_id = v_old_rebate.fee_component_id;

    -- Mark adjustment cancelled (must also set cancelled_at & cancelled_by to satisfy check constraint)
    UPDATE fee_adjustments
    SET status = 'CANCELLED',
      cancelled_at = CURRENT_TIMESTAMP,
      cancelled_by = COALESCE(p_created_by, v_auth_user_id),
      cancellation_reason = 'Reversed during payment update',
      updated_at = CURRENT_TIMESTAMP,
      updated_by = COALESCE(p_created_by, v_auth_user_id),
      reason = COALESCE(reason,'') || ' | Reversed during payment update'
    WHERE id = v_old_rebate.id;

      -- Ledger event for reversal
      INSERT INTO fee_ledger_events (
        event_type,
        enrollment_id,
        academic_year,
        fee_component_id,
        amount,
        running_balance,
        receipt_id,
        description,
        created_by,
        created_at
      ) VALUES (
        'ADJUSTMENT_MADE',
        p_enrollment_id,
        v_academic_year_short,
        v_old_rebate.fee_component_id,
        v_old_rebate.amount, -- positive to negate prior negative discount
        0,
        p_receipt_id,
        'Rebate reversed on payment edit',
        COALESCE(p_created_by, v_auth_user_id),
        CURRENT_TIMESTAMP
      );
      v_ledger_events_created := v_ledger_events_created + 1;
    END LOOP;

    -- 3. Apply new rebate (if any)
    IF p_rebate_amount > 0 AND p_rebate_reason IS NOT NULL THEN
      SELECT id INTO v_fee_component_id FROM fee_components WHERE code = 'TUITION' LIMIT 1;
      IF v_fee_component_id IS NOT NULL THEN
        INSERT INTO fee_adjustments (
          enrollment_id,
          academic_year,
          fee_component_id,
          adjustment_type,
          amount,
          title,
          reason,
          status,
          effective_date,
          created_by,
          created_at
        ) VALUES (
          p_enrollment_id,
          v_academic_year_short,
          v_fee_component_id,
          'DISCOUNT',
          p_rebate_amount,
          'Payment Rebate: ' || p_rebate_reason,
          p_rebate_reason,
          'ACTIVE',
          p_receipt_date,
          COALESCE(p_created_by, v_auth_user_id),
          CURRENT_TIMESTAMP
        ) RETURNING id INTO v_rebate_adjustment_id;

        -- Ledger event (discount applied)
        INSERT INTO fee_ledger_events (
          event_type,
            enrollment_id,
            academic_year,
            fee_component_id,
            amount,
            running_balance,
            description,
            created_by,
            created_at,
            receipt_id
        ) VALUES (
          'DISCOUNT_APPLIED',
          p_enrollment_id,
          v_academic_year_short,
          v_fee_component_id,
          -p_rebate_amount,
          0,
          'Rebate: ' || p_rebate_reason,
          COALESCE(p_created_by, v_auth_user_id),
          CURRENT_TIMESTAMP,
          p_receipt_id
        );
        v_ledger_events_created := v_ledger_events_created + 1;

        -- Update balances for rebate
        UPDATE fee_current_balances
        SET
          discount_amount = COALESCE(discount_amount,0) + p_rebate_amount,
          charged_amount = GREATEST(0, charged_amount - p_rebate_amount),
          outstanding_amount = GREATEST(0, outstanding_amount - p_rebate_amount),
          last_updated_at = CURRENT_TIMESTAMP,
          last_updated_by = COALESCE(p_created_by, v_auth_user_id)
        WHERE enrollment_id = p_enrollment_id
          AND fee_component_id = v_fee_component_id;
      END IF;
    END IF;

    -- 4. (Pre-payment) Create balance snapshot BEFORE applying new allocations
    -- We capture the state after reversing old payment & rebate but before applying the new payment.
    DELETE FROM fee_receipt_balance_records WHERE receipt_id = p_receipt_id; -- refresh snapshot for this receipt
    INSERT INTO fee_receipt_balance_records (
      receipt_id,
      fee_component_id,
      charge_amount,
      paid_amount,
      balance_amount,
      enrollment_id,
      academic_year,
      receipt_date,
      created_at
    )
    SELECT 
      p_receipt_id,
      fcb.fee_component_id,
      fcb.charged_amount,
      fcb.paid_amount,
      (fcb.charged_amount - fcb.paid_amount) AS balance_amount,
      fcb.enrollment_id,
      v_academic_year_short,
      p_receipt_date,
      CURRENT_TIMESTAMP
    FROM fee_current_balances fcb
    WHERE fcb.enrollment_id = p_enrollment_id
      AND fcb.deleted_at IS NULL
      AND (
        (fcb.charged_amount - fcb.paid_amount) > 0 OR 
        (fcb.paid_amount > 0 AND (fcb.charged_amount - fcb.paid_amount) = 0)
      );

    -- 5. Recreate allocations from new component payments (applies payment)
  FOR v_component_key, v_payment_amount IN
      SELECT key, (value)::numeric
      FROM jsonb_each_text(p_component_payments)
      WHERE (value)::numeric > 0
    LOOP
      v_fee_component_id := NULL;
      SELECT id INTO v_fee_component_id FROM fee_components WHERE code = v_component_key LIMIT 1;
      IF v_fee_component_id IS NOT NULL THEN
        DECLARE v_ledger_event_id UUID; BEGIN
          INSERT INTO fee_ledger_events (
            event_type,
            enrollment_id,
            academic_year,
            fee_component_id,
            amount,
            running_balance,
            receipt_id,
            description,
            created_by,
            created_at
          ) VALUES (
            'PAYMENT_RECEIVED',
            p_enrollment_id,
            v_academic_year_short,
            v_fee_component_id,
            v_payment_amount,
            0,
            p_receipt_id,
            'Payment allocation (edit): ' || v_component_key,
            COALESCE(p_created_by, v_auth_user_id),
            CURRENT_TIMESTAMP
          ) RETURNING id INTO v_ledger_event_id;
          v_ledger_events_created := v_ledger_events_created + 1;

          INSERT INTO fee_receipt_allocations (
            receipt_id,
            ledger_event_id,
            fee_component_id,
            allocated_amount,
            enrollment_id,
            academic_year,
            receipt_date
          ) VALUES (
            p_receipt_id,
            v_ledger_event_id,
            v_fee_component_id,
            v_payment_amount,
            p_enrollment_id,
            v_academic_year_short,
            p_receipt_date
          );
          v_allocations_created := v_allocations_created + 1;

          -- Update balances (add new amounts)
          UPDATE fee_current_balances
          SET
            paid_amount = COALESCE(paid_amount,0) + v_payment_amount,
            outstanding_amount = GREATEST(0, COALESCE(outstanding_amount,0) - v_payment_amount),
            last_updated_at = CURRENT_TIMESTAMP,
            last_updated_by = COALESCE(p_created_by, v_auth_user_id)
          WHERE enrollment_id = p_enrollment_id
            AND fee_component_id = v_fee_component_id;
          GET DIAGNOSTICS v_rows = ROW_COUNT; -- rows affected by UPDATE
          IF v_rows > 0 THEN
            v_balances_updated := v_balances_updated + v_rows;
          ELSE
            -- No existing balance row, create fresh one
            INSERT INTO fee_current_balances (
              enrollment_id,
              fee_component_id,
              academic_year,
              charged_amount,
              paid_amount,
              outstanding_amount,
              last_updated_at,
              last_updated_by
            ) VALUES (
              p_enrollment_id,
              v_fee_component_id,
              v_academic_year_short,
              0,
              v_payment_amount,
              0,
              CURRENT_TIMESTAMP,
              COALESCE(p_created_by, v_auth_user_id)
            );
            v_balances_updated := v_balances_updated + 1;
          END IF;
        END; -- inner block
      END IF;
    END LOOP;

  -- 6. Update the receipt master row (set is_edited flag instead of altering remarks text)
    UPDATE fee_receipts
    SET
      receipt_number = p_receipt_number,
      receipt_date = p_receipt_date,
      academic_year = v_academic_year_short,
      payment_method = p_payment_method::payment_method_type,
      total_amount = p_total_amount,
      paid_amount = p_total_amount,
      balance_amount = 0,
      is_edited = true,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = COALESCE(p_created_by, v_auth_user_id)
    WHERE id = p_receipt_id;

    -- Return JSON result
    RETURN jsonb_build_object(
      'success', true,
      'receipt_id', p_receipt_id,
      'receipt_number', p_receipt_number,
      'allocations_created', v_allocations_created,
      'ledger_events_created', v_ledger_events_created,
      'balances_updated', v_balances_updated,
      'message', 'Payment updated successfully'
    );

  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Payment update failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END; -- transactional block
END;
$function$


-- Function: update_student_fee_overrides_updated_by
-- Type: function
-- Language: plpgsql
-- Arguments: 
-- Return Type: trigger
CREATE OR REPLACE FUNCTION public.update_student_fee_overrides_updated_by()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only update if updated_by is provided in the NEW record
  IF NEW.updated_by IS NOT NULL THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$


-- Function: user_has_permission
-- Type: function
-- Language: plpgsql
-- Arguments: p_user_id uuid, p_resource_type text, p_operation text, p_scope_level text DEFAULT 'GLOBAL'::text
-- Return Type: boolean
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_resource_type text, p_operation text, p_scope_level text DEFAULT 'GLOBAL'::text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
    BEGIN
      -- Simple check: allow if user is authenticated
      RETURN p_user_id IS NOT NULL;
    END;
    $function$


-- Function: word_similarity
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: word_similarity_commutator_op
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: boolean
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: word_similarity_dist_commutator_op
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: word_similarity_dist_op
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: real
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


-- Function: word_similarity_op
-- Type: function
-- Language: c
-- Arguments: text, text
-- Return Type: boolean
-- Removed: pg_trgm extension function (provided by CREATE EXTENSION pg_trgm)


