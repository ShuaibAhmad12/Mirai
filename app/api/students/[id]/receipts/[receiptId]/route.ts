import { NextRequest, NextResponse } from "next/server";
import {
  feePaymentService,
  PaymentRequest,
} from "@/lib/services/fee-payment.service";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  try {
    const { id, receiptId } = await params;
    const studentId = id;
    const paymentData = await request.json();

    console.log("🔍 PATCH Receipt Debug:", {
      studentId,
      receiptId,
      receiptIdType: typeof receiptId,
      paymentDataKeys: Object.keys(paymentData),
    });

    // Get enrollment ID for the student
    const supabase = await createClient();
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) {
      return NextResponse.json(
        { error: "Student enrollment not found" },
        { status: 404 }
      );
    }

    // Verify receipt exists and belongs to this student
    const { data: existingReceipt, error: receiptError } = await supabase
      .from("fee_receipts")
      .select("id, receipt_number, enrollment_id")
      .eq("id", receiptId)
      .eq("enrollment_id", enrollmentData.enrollment_id)
      .single();

    console.log("🔍 Receipt Lookup Result:", {
      existingReceipt,
      receiptError,
      query: { id: receiptId, enrollment_id: enrollmentData.enrollment_id },
    });

    if (receiptError || !existingReceipt) {
      return NextResponse.json(
        { error: "Receipt not found or does not belong to this student" },
        { status: 404 }
      );
    }

    // Prepare payment request for the update
    const paymentRequest: PaymentRequest = {
      student_id: studentId,
      enrollment_id: enrollmentData.enrollment_id,
      receipt_number: paymentData.receipt_number,
      receipt_date: paymentData.receipt_date,
      academic_year: paymentData.academic_year,
      payment_method: paymentData.payment_method,
      remarks: paymentData.remarks,
      total_amount: paymentData.total_amount,
      component_payments: paymentData.component_payments,
      rebate_amount: paymentData.rebate_amount,
      rebate_reason: paymentData.rebate_reason,
      current_year: paymentData.current_year,
      created_by: paymentData.created_by || null,
    };

    // Validate payment request
    const validation = await feePaymentService.validatePaymentRequest(
      paymentRequest,
      receiptId
    );
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Update the receipt using the payment service
    const result = await feePaymentService.updatePayment(
      receiptId,
      paymentRequest
    );

    return NextResponse.json(
      {
        ...result,
        validation:
          validation.warnings.length > 0
            ? { warnings: validation.warnings }
            : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating payment receipt:", error);
    return NextResponse.json(
      {
        error: "Payment update failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Return a detailed single receipt (allocations + balances) for preview/print
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  try {
    const { id, receiptId } = await params;
    const supabase = await createClient();

    // Verify enrollment for student
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id, student_id")
      .eq("student_id", id)
      .single();

    if (enrollmentError || !enrollmentData) {
      return NextResponse.json(
        { error: "Student enrollment not found" },
        { status: 404 }
      );
    }

    // Fetch receipt with allocations
    const { data: receipt, error: receiptError } = await supabase
      .from("fee_receipts")
      .select(
        `id, receipt_number, receipt_date, payment_method, academic_year, remarks, status, total_amount, paid_amount, balance_amount, enrollment_id,
        fee_receipt_allocations ( allocated_amount, fee_components ( code, label ) )`
      )
      .eq("id", receiptId)
      .eq("enrollment_id", enrollmentData.enrollment_id)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    // Fetch pre-payment balance snapshot components
    const { data: balanceRecords } = await supabase
      .from("fee_receipt_balance_records")
      .select(`balance_amount, fee_components ( code, label )`)
      .eq("receipt_id", receipt.id);

    interface RawAllocation {
      allocated_amount: number;
      fee_components?: { code?: string; label?: string } | null;
    }
    const allocationDetails = (
      (receipt.fee_receipt_allocations || []) as RawAllocation[]
    ).map((a) => ({
      component_code: a.fee_components?.code || "UNKNOWN",
      component_name: a.fee_components?.label || "Unknown",
      allocated_amount: a.allocated_amount,
    }));

    return NextResponse.json({
      id: receipt.id,
      receipt_number: receipt.receipt_number,
      receipt_date: receipt.receipt_date,
      academic_year: receipt.academic_year,
      payment_method: receipt.payment_method,
      remarks: receipt.remarks,
      status: receipt.status,
      paid_amount: receipt.paid_amount,
      balance_amount: receipt.balance_amount,
      total_amount: receipt.total_amount,
      allocations: allocationDetails,
      balance_records: (
        (balanceRecords || []) as Array<{
          balance_amount: number;
          fee_components?: { code?: string; label?: string } | null;
        }>
      ).map((b) => ({
        component_code: b.fee_components?.code || "UNKNOWN",
        component_name: b.fee_components?.label || "Unknown",
        balance_amount: b.balance_amount,
      })),
    });
  } catch (error) {
    console.error("Error fetching receipt detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch receipt detail" },
      { status: 500 }
    );
  }
}
