import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Mock payment data for now - would use params.id in real implementation

    const payments = [
      {
        id: "1",
        student_name: "John Doe",
        course_name: "Computer Science",
        college_name: "ABC University",
        commission_amount: 25000,
        commission_rate: 5,
        payment_status: "paid",
        payment_date: "2024-01-15",
        payment_method: "Bank Transfer",
        transaction_id: "TXN123456",
        notes: null,
        created_at: "2024-01-10",
      },
      {
        id: "2",
        student_name: "Jane Smith",
        course_name: "Business Administration",
        college_name: "XYZ College",
        commission_amount: 18000,
        commission_rate: 4,
        payment_status: "pending",
        payment_date: null,
        payment_method: null,
        transaction_id: null,
        notes: "Waiting for student enrollment confirmation",
        created_at: "2024-01-20",
      },
    ];

    return NextResponse.json({
      payments,
      total: payments.length,
    });
  } catch (error) {
    console.error("Error fetching agent payments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
