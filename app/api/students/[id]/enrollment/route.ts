import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;
    const updates = await request.json();

    const supabase = await createClient();

    // Get current user for audit
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the current enrollment for this student
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) {
      return NextResponse.json(
        { error: "Current enrollment not found" },
        { status: 404 }
      );
    }

    // Update the enrollment record
    const { error: updateError } = await supabase
      .from("student_enrollments")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", enrollmentData.enrollment_id);

    if (updateError) {
      console.error("Error updating enrollment:", updateError);
      return NextResponse.json(
        { error: "Failed to update enrollment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Enrollment updated successfully" });
  } catch (error) {
    console.error("Error in enrollment update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
