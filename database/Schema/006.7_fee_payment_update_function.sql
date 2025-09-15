-- Update Fee Payment Function
-- Provides atomic update of an existing fee payment (receipt) by reversing prior effects
-- and re-applying new component allocations, rebate, ledger events, and balance snapshots.
-- Mirrors core logic from process_fee_payment while preserving the original receipt ID.

CREATE OR REPLACE FUNCTION update_fee_payment(
  p_receipt_id UUID,
  p_enrollment_id UUID,
  p_receipt_number TEXT,
  p_receipt_date DATE,
  p_academic_year TEXT,
  p_payment_method TEXT,
  p_total_amount NUMERIC(12,2),
  p_component_payments JSONB,
  p_rebate_amount NUMERIC(12,2) DEFAULT 0,
  p_rebate_reason TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- NOTE: Ensure appropriate RLS policies allow calling this function via RPC.
