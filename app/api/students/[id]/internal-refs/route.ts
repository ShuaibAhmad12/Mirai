import { NextRequest, NextResponse } from "next/server";
import { studentService } from "@/lib/services/student.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;

    const internalRefs = await studentService.getStudentInternalRefs(studentId);

    return NextResponse.json(internalRefs);
  } catch (error) {
    console.error("Error fetching internal refs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;
    const { refs } = await request.json();

    const updatedRefs = await studentService.updateInternalRefs(
      studentId,
      refs
    );

    return NextResponse.json({
      success: true,
      updated_refs: updatedRefs,
    });
  } catch (error) {
    console.error("Error updating internal refs:", error);
    return NextResponse.json(
      { error: "Failed to update internal refs" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;
    const { refs } = await request.json();

    const updatedRefs = await studentService.updateInternalRefs(
      studentId,
      refs
    );

    return NextResponse.json({
      success: true,
      updated_refs: updatedRefs,
    });
  } catch (error) {
    console.error("Error updating internal refs:", error);
    return NextResponse.json(
      { error: "Failed to update internal refs" },
      { status: 500 }
    );
  }
}
