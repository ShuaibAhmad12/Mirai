import { createClient } from "@/lib/supabase/server";

export interface PaymentAllocation {
  component_code: string;
  component_name: string;
  year_number?: number;
  allocated_amount: number;
  fee_component_id: string;
}

export interface PaymentRequest {
  student_id: string;
  enrollment_id: string;
  receipt_number: string;
  receipt_date: string;
  academic_year: string;
  payment_method: string;
  remarks?: string;
  total_amount: number;
  component_payments: Record<string, number>; // component_code -> payment amount
  rebate_amount?: number;
  rebate_reason?: string;
  current_year: number;
  created_by?: string;
}

export interface PaymentResult {
  success: boolean;
  receipt_id: string;
  receipt_number: string;
  message: string;
  allocations_created: number;
  ledger_events_created: number;
  balances_updated: number;
}

export class FeePaymentService {
  private async getSupabase() {
    return await createClient();
  }

  /**
   * Process a complete fee payment with all related table updates
   */
  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResult> {
    const supabase = await this.getSupabase();

    try {
      // Start transaction
      const { data: receipt, error: receiptError } = await supabase.rpc(
        "process_fee_payment",
        {
          p_student_id: paymentRequest.student_id,
          p_enrollment_id: paymentRequest.enrollment_id,
          p_receipt_number: paymentRequest.receipt_number,
          p_receipt_date: paymentRequest.receipt_date,
          p_academic_year: paymentRequest.academic_year,
          p_payment_method: paymentRequest.payment_method,
          p_total_amount: paymentRequest.total_amount,
          p_component_payments: paymentRequest.component_payments,
          p_current_year: paymentRequest.current_year,
          p_remarks: paymentRequest.remarks,
          p_rebate_amount: paymentRequest.rebate_amount || 0,
          p_rebate_reason: paymentRequest.rebate_reason,
          p_created_by: paymentRequest.created_by || null,
        }
      );

      if (receiptError) {
        console.error("Payment processing error:", receiptError);
        throw new Error(`Payment processing failed: ${receiptError.message}`);
      }

      return {
        success: true,
        receipt_id: receipt.receipt_id,
        receipt_number: receipt.receipt_number,
        message: "Payment processed successfully",
        allocations_created: receipt.allocations_created || 0,
        ledger_events_created: receipt.ledger_events_created || 0,
        balances_updated: receipt.balances_updated || 0,
      };
    } catch (error) {
      console.error("Payment processing failed:", error);
      throw error;
    }
  }

  /**
   * Update an existing payment receipt with new data
   * Simple PATCH approach: update receipt and recalculate allocations
   */
  async updatePayment(
    receiptId: string,
    paymentRequest: PaymentRequest
  ): Promise<PaymentResult> {
    const supabase = await this.getSupabase();
    try {
      const { data: result, error } = await supabase.rpc("update_fee_payment", {
        p_receipt_id: receiptId,
        p_enrollment_id: paymentRequest.enrollment_id,
        p_receipt_number: paymentRequest.receipt_number,
        p_receipt_date: paymentRequest.receipt_date,
        p_academic_year: paymentRequest.academic_year,
        p_payment_method: paymentRequest.payment_method,
        p_total_amount: paymentRequest.total_amount,
        p_component_payments: paymentRequest.component_payments,
        p_rebate_amount: paymentRequest.rebate_amount || 0,
        p_rebate_reason: paymentRequest.rebate_reason,
        p_created_by: paymentRequest.created_by || null,
      });

      if (error) {
        console.error("Payment update RPC error:", error);
        throw new Error(`Payment update failed: ${error.message}`);
      }

      return {
        success: true,
        receipt_id: result.receipt_id,
        receipt_number: result.receipt_number,
        message: result.message || "Payment updated successfully",
        allocations_created: result.allocations_created || 0,
        ledger_events_created: result.ledger_events_created || 0,
        balances_updated: result.balances_updated || 0,
      };
    } catch (err) {
      console.error("Payment update failed:", err);
      throw err;
    }
  }
  async updatePaymentOLD(
    receiptId: string,
    paymentRequest: PaymentRequest
  ): Promise<PaymentResult> {
    const supabase = await this.getSupabase();

    try {
      // First verify the receipt exists and get current data
      const { data: currentReceipt, error: fetchError } = await supabase
        .from("fee_receipts")
        .select("id, receipt_number, enrollment_id, created_by")
        .eq("id", receiptId)
        .single();

      if (fetchError || !currentReceipt) {
        throw new Error("Receipt not found");
      }

      // Manually delete existing allocations and ledger entries (simpler than cancelPayment)
      // Delete existing allocations for this receipt
      const { error: deleteAllocationsError } = await supabase
        .from("fee_receipt_allocations")
        .delete()
        .eq("receipt_id", receiptId);

      if (deleteAllocationsError) {
        console.error(
          "Error deleting old allocations:",
          deleteAllocationsError
        );
        throw new Error(
          `Failed to delete old allocations: ${deleteAllocationsError.message}`
        );
      }

      // Delete existing ledger entries for this receipt
      const { error: deleteLedgerError } = await supabase
        .from("fee_ledger_events")
        .delete()
        .eq("receipt_id", receiptId);

      if (deleteLedgerError) {
        console.error("Error deleting old ledger entries:", deleteLedgerError);
        throw new Error(
          `Failed to delete old ledger entries: ${deleteLedgerError.message}`
        );
      }

      // Now recreate the payment with new data using the existing process_fee_payment procedure
      const { data: receipt, error: receiptError } = await supabase.rpc(
        "process_fee_payment",
        {
          p_student_id: paymentRequest.student_id,
          p_enrollment_id: paymentRequest.enrollment_id,
          p_receipt_number: paymentRequest.receipt_number,
          p_receipt_date: paymentRequest.receipt_date,
          p_academic_year: paymentRequest.academic_year,
          p_payment_method: paymentRequest.payment_method,
          p_total_amount: paymentRequest.total_amount,
          p_component_payments: paymentRequest.component_payments,
          p_current_year: paymentRequest.current_year,
          p_remarks: paymentRequest.remarks,
          p_rebate_amount: paymentRequest.rebate_amount || 0,
          p_rebate_reason: paymentRequest.rebate_reason,
          p_created_by: paymentRequest.created_by || currentReceipt.created_by,
        }
      );

      if (receiptError) {
        console.error("Payment recreation error:", receiptError);
        throw new Error(`Payment recreation failed: ${receiptError.message}`);
      }

      // Update the new receipt to use the original receipt ID to maintain references
      // First update allocations to point to the original receipt ID
      const { error: updateAllocationsError } = await supabase
        .from("fee_receipt_allocations")
        .update({ receipt_id: receiptId })
        .eq("receipt_id", receipt.receipt_id);

      if (updateAllocationsError) {
        console.error("Error updating allocations:", updateAllocationsError);
      }

      // Update ledger entries to point to the original receipt ID
      const { error: updateLedgerError } = await supabase
        .from("fee_ledger_events")
        .update({ receipt_id: receiptId })
        .eq("receipt_id", receipt.receipt_id);

      if (updateLedgerError) {
        console.error("Error updating ledger entries:", updateLedgerError);
      }

      // Delete the newly created receipt (we want to keep the original)
      const { error: deleteNewReceiptError } = await supabase
        .from("fee_receipts")
        .delete()
        .eq("id", receipt.receipt_id);

      if (deleteNewReceiptError) {
        console.error("Error deleting new receipt:", deleteNewReceiptError);
      }

      // Update the original receipt with the new data
      const { error: updateReceiptError } = await supabase
        .from("fee_receipts")
        .update({
          receipt_number: paymentRequest.receipt_number,
          receipt_date: paymentRequest.receipt_date,
          academic_year: paymentRequest.academic_year,
          payment_method: paymentRequest.payment_method,
          total_amount: paymentRequest.total_amount,
          paid_amount: paymentRequest.total_amount,
          balance_amount: 0,
          remarks: paymentRequest.remarks,
          updated_at: new Date().toISOString(),
        })
        .eq("id", receiptId);

      if (updateReceiptError) {
        console.error("Error updating original receipt:", updateReceiptError);
        throw new Error(
          `Failed to update receipt: ${updateReceiptError.message}`
        );
      }

      return {
        success: true,
        receipt_id: receiptId,
        receipt_number: paymentRequest.receipt_number,
        message: "Payment updated successfully",
        allocations_created: receipt.allocations_created || 0,
        ledger_events_created: receipt.ledger_events_created || 0,
        balances_updated: receipt.balances_updated || 0,
      };
    } catch (error) {
      console.error("Payment update failed:", error);
      throw error;
    }
  }

  /**
   * Get payment allocations for a receipt
   */
  async getPaymentAllocations(receiptId: string): Promise<PaymentAllocation[]> {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase
      .from("fee_receipt_allocations")
      .select(
        `
        allocated_amount,
        fee_components (
          code,
          label,
          id
        ),
        fee_plan_items (
          year_number
        )
      `
      )
      .eq("receipt_id", receiptId);

    if (error) throw error;

    return (data || []).map(
      (allocation: {
        allocated_amount: number;
        fee_components: { code: string; label: string; id: string }[];
        fee_plan_items: { year_number: number }[];
      }) => ({
        component_code: allocation.fee_components?.[0]?.code || "",
        component_name: allocation.fee_components?.[0]?.label || "",
        year_number: allocation.fee_plan_items?.[0]?.year_number,
        allocated_amount: allocation.allocated_amount,
        fee_component_id: allocation.fee_components?.[0]?.id || "",
      })
    );
  }

  /**
   * Cancel a payment and reverse all related updates
   */
  async cancelPayment(
    receiptId: string,
    reason: string,
    cancelledBy: string
  ): Promise<void> {
    const supabase = await this.getSupabase();

    const { error } = await supabase.rpc("cancel_fee_payment", {
      p_receipt_id: receiptId,
      p_cancellation_reason: reason,
      p_cancelled_by: cancelledBy,
    });

    if (error) {
      console.error("Payment cancellation error:", error);
      throw new Error(`Payment cancellation failed: ${error.message}`);
    }
  }

  /**
   * Get payment summary for a student
   */
  async getPaymentSummary(studentId: string) {
    const supabase = await this.getSupabase();

    // Get enrollment ID
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) {
      throw new Error("Student enrollment not found");
    }

    // Get payment summary using RPC function
    const { data, error } = await supabase.rpc("get_fee_payment_summary", {
      p_enrollment_id: enrollmentData.enrollment_id,
    });

    if (error) throw error;

    return data;
  }

  /**
   * Validate payment request before processing
   */
  async validatePaymentRequest(
    paymentRequest: PaymentRequest,
    excludeReceiptId?: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!paymentRequest.receipt_number?.trim()) {
      errors.push("Receipt number is required");
    }

    if (paymentRequest.total_amount <= 0) {
      errors.push("Total payment amount must be greater than 0");
    }

    if (paymentRequest.rebate_amount && paymentRequest.rebate_amount > 0) {
      if (!paymentRequest.rebate_reason?.trim()) {
        errors.push("Rebate reason is required when applying a rebate");
      }
    }

    // Check if receipt number already exists
    const supabase = await this.getSupabase();
    let receiptQuery = supabase
      .from("fee_receipts")
      .select("id")
      .eq("receipt_number", paymentRequest.receipt_number)
      .eq("status", "ACTIVE");

    // Exclude current receipt if updating
    if (excludeReceiptId) {
      receiptQuery = receiptQuery.neq("id", excludeReceiptId);
    }

    const { data: existingReceipt } = await receiptQuery.single();

    if (existingReceipt) {
      errors.push("Receipt number already exists");
    }

    // Validate component payments
    const totalAllocated = Object.values(
      paymentRequest.component_payments
    ).reduce((sum, amount) => sum + (amount || 0), 0);

    if (Math.abs(totalAllocated - paymentRequest.total_amount) > 0.01) {
      errors.push("Total allocated amount does not match payment amount");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export const feePaymentService = new FeePaymentService();
