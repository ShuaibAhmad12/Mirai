-- Fee Payment Processing Functions (Supabase Optimized)
-- These functions handle complex payment processing with proper transaction management
-- Follows Supabase best practices for security, performance, and reliability

-- ============================================================================
-- ENSURE REQUIRED DEPENDENCIES EXIST
-- ============================================================================

-- Check if required functions exist (from RBAC system)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'user_has_permission' 
    AND pg_function_is_visible(oid)
  ) THEN
    -- Create a simple stub function if RBAC is not available
    CREATE OR REPLACE FUNCTION user_has_permission(
      p_user_id UUID,
      p_resource_type TEXT,
      p_operation TEXT,
      p_scope_level TEXT DEFAULT 'GLOBAL'
    )
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY INVOKER
    AS $stub$
    BEGIN
      -- Simple check: allow if user is authenticated
      RETURN p_user_id IS NOT NULL;
    END;
    $stub$;
    
    RAISE NOTICE 'Created stub user_has_permission function. Install RBAC system for full security.';
  END IF;
END $$;

-- ============================================================================
-- PAYMENT PROCESSING FUNCTION (MAIN)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_fee_payment(
  p_student_id UUID,
  p_enrollment_id UUID,
  p_receipt_number TEXT,
  p_receipt_date DATE,
  p_academic_year TEXT,
  p_payment_method TEXT,
  p_total_amount NUMERIC(12,2),
  p_component_payments JSONB,
  p_current_year INTEGER,
  p_remarks TEXT DEFAULT NULL,
  p_rebate_amount NUMERIC(12,2) DEFAULT 0,
  p_rebate_reason TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Use SECURITY DEFINER for controlled access
SET search_path = public -- Security: Prevent function hijacking
AS $$
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
$$;

-- ============================================================================
-- PAYMENT CANCELLATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_fee_payment(
  p_receipt_id UUID,
  p_cancellation_reason TEXT,
  p_cancelled_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================================================
-- PAYMENT SUMMARY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_fee_payment_summary(p_enrollment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on fee_receipts if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_receipts') THEN
    ALTER TABLE fee_receipts ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "fee_receipts_select_policy" ON fee_receipts;
    DROP POLICY IF EXISTS "fee_receipts_insert_policy" ON fee_receipts;
    DROP POLICY IF EXISTS "fee_receipts_update_policy" ON fee_receipts;
    
    -- Policy for viewing receipts
    CREATE POLICY "fee_receipts_select_policy" ON fee_receipts
      FOR SELECT USING (
        user_has_permission(auth.uid()::UUID, 'FEES', 'READ') OR
        EXISTS (
          SELECT 1 FROM student_user_profiles sup
          JOIN v_student_current_enrollment vsce ON sup.student_id = vsce.student_id
          WHERE sup.user_id = auth.uid() AND vsce.enrollment_id = enrollment_id
        )
      );

    -- Policy for creating receipts
    CREATE POLICY "fee_receipts_insert_policy" ON fee_receipts
      FOR INSERT WITH CHECK (
        user_has_permission(auth.uid()::UUID, 'FEES', 'CREATE')
      );

    -- Policy for updating receipts
    CREATE POLICY "fee_receipts_update_policy" ON fee_receipts
      FOR UPDATE USING (
        user_has_permission(auth.uid()::UUID, 'FEES', 'UPDATE')
      );
      
    RAISE NOTICE 'RLS policies created for fee_receipts table';
  ELSE
    RAISE NOTICE 'fee_receipts table not found, skipping RLS policies';
  END IF;
END $$;

-- Enable RLS on fee_receipt_allocations if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_receipt_allocations') THEN
    ALTER TABLE fee_receipt_allocations ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "fee_receipt_allocations_select_policy" ON fee_receipt_allocations;
    
    -- Policy for viewing allocations
    CREATE POLICY "fee_receipt_allocations_select_policy" ON fee_receipt_allocations
      FOR SELECT USING (
        user_has_permission(auth.uid()::UUID, 'FEES', 'READ')
      );
      
    RAISE NOTICE 'RLS policies created for fee_receipt_allocations table';
  ELSE
    RAISE NOTICE 'fee_receipt_allocations table not found, skipping RLS policies';
  END IF;
END $$;

-- ============================================================================
-- GRANT PERMISSIONS (SUPABASE OPTIMIZED)
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION process_fee_payment(UUID, UUID, TEXT, DATE, TEXT, TEXT, NUMERIC, JSONB, INTEGER, TEXT, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_fee_payment(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_fee_payment_summary(UUID) TO authenticated;

-- Additional permissions for service operations
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- ============================================================================
-- FUNCTION DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON FUNCTION process_fee_payment IS 'Processes complete fee payment with component allocation, rebate handling, and audit trail creation. Enforces RBAC permissions and data validation.';
COMMENT ON FUNCTION cancel_fee_payment IS 'Cancels a payment receipt and reverses all associated balance updates. Requires DELETE permission on FEES resource.';
COMMENT ON FUNCTION get_fee_payment_summary IS 'Returns comprehensive payment summary for an enrollment including totals and last payment date. Requires READ permission on FEES resource.';
