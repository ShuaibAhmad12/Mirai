import { NextRequest, NextResponse } from "next/server";
import { feesService } from "@/lib/services/fees.service";
import {
  feePaymentService,
  PaymentRequest,
} from "@/lib/services/fee-payment.service";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;

    const [
      feeSummary,
      recentPayments,
      feeDetails,
      detailedReceipts,
      detailedCharges,
    ] = await Promise.all([
      feesService.getFeeSummary(studentId),
      feesService.getRecentPayments(studentId, 10),
      feesService.getFeeDetails(studentId),
      feesService.getFeeReceiptsDetailed(studentId),
      feesService.getFeeChargesDetailed(studentId),
    ]);

    const feesData = {
      fee_summary: feeSummary,
      recent_payments: recentPayments,
      fee_details: feeDetails,
      detailed_receipts: detailedReceipts,
      detailed_charges: detailedCharges,
    };

    return NextResponse.json(feesData);
  } catch (error) {
    console.error("Error fetching fees data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;
    const paymentData = await request.json();

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

    // Prepare payment request for the new service
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
      paymentRequest
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

    // Process payment using the new service
    const result = await feePaymentService.processPayment(paymentRequest);

    return NextResponse.json(
      {
        ...result,
        validation:
          validation.warnings.length > 0
            ? { warnings: validation.warnings }
            : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error processing payment:", error);
    return NextResponse.json(
      {
        error: "Payment processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
