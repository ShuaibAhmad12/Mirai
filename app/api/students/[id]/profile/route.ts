import { NextRequest, NextResponse } from "next/server";
import { studentService } from "@/lib/services/student.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;
    const updates = await request.json();

    const updatedProfile = await studentService.updateStudentProfile(
      studentId,
      updates
    );

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating student profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
