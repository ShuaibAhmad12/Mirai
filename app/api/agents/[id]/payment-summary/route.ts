import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Mock payment summary data for now
    const summary = {
      total_earned: 125000,
      total_pending: 45000,
      this_month_earned: 25000,
      this_month_pending: 18000,
      payment_count: 8,
      pending_count: 3,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error fetching payment summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
