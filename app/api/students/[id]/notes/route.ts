import { NextRequest, NextResponse } from "next/server";
import { studentService } from "@/lib/services/student.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    const notesData = await studentService.getStudentNotes(
      studentId,
      limit,
      offset
    );

    return NextResponse.json(notesData);
  } catch (error) {
    console.error("Error fetching notes:", error);
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
    const { note, created_by } = await request.json();

    if (!note?.trim()) {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      );
    }

    const newNote = await studentService.addStudentNote(
      studentId,
      note.trim(),
      created_by
    );

    return NextResponse.json(newNote, { status: 201 });
  } catch (error) {
    console.error("Error adding note:", error);
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}
