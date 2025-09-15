import { NextRequest, NextResponse } from "next/server";
import { svcPreviewEnrollmentCodeFor } from "@/lib/services/admissions.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { college_id, session_id } = body || {};
    if (!college_id || !session_id) {
      return NextResponse.json(
        { error: "college_id and session_id are required" },
        { status: 400 }
      );
    }
    const { enrollment_code } = await svcPreviewEnrollmentCodeFor({
      college_id,
      session_id,
    });
    return NextResponse.json({ enrollment_code });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
