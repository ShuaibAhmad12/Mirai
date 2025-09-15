import { NextRequest, NextResponse } from "next/server";
import { feesService } from "@/lib/services/fees.service";
import { AddAdjustmentRequest } from "@/lib/types/student-api.types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;
    console.log("Received student ID for adjustment:", studentId);
    const data: AddAdjustmentRequest = await request.json();
    console.log("Adjustment data:", data);

    // Validate required fields
    if (!data.adjustment_type || !data.amount || !data.title || !data.reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (data.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    // Create the adjustment
    const result = await feesService.createAdjustment(studentId, data);

    return NextResponse.json({
      success: true,
      adjustment: result,
      message: "Fee adjustment created successfully",
    });
  } catch (error) {
    console.error("Error creating adjustment:", error);
    return NextResponse.json(
      {
        error: "Failed to create adjustment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
