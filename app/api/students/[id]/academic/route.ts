import { NextRequest, NextResponse } from "next/server";
import { enrollmentService } from "@/lib/services/enrollment.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;

    const [academicHistory, priorEducation] = await Promise.all([
      enrollmentService.getAcademicHistory(studentId),
      enrollmentService.getPriorEducation(studentId),
    ]);

    const academicData = {
      academic_history: academicHistory,
      prior_education: priorEducation,
    };

    return NextResponse.json(academicData);
  } catch (error) {
    console.error("Error fetching academic data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  // { params }: { params: Promise<{ id: string }> }
) {
  try {
    // const { id } = await params;
    // const studentId = id;
    const updates = await request.json();

    // Handle different types of academic updates
    const updatedData = await enrollmentService.updateAcademicInfo(
      updates
    );

    return NextResponse.json({
      success: true,
      academic: updatedData,
    });
  } catch (error) {
    console.error("Error updating academic information:", error);
    return NextResponse.json(
      { error: "Failed to update academic information" },
      { status: 500 }
    );
  }
}
