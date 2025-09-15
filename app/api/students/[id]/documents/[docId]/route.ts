import { NextRequest, NextResponse } from "next/server";
import { studentService } from "@/lib/services/student.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params;
    const studentId = id;
    const updates = await request.json();

    const updatedDocument = await studentService.updateStudentDocument(
      docId,
      updates
    );

    return NextResponse.json({
      success: true,
      document: updatedDocument,
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}
