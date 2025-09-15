import { NextRequest, NextResponse } from "next/server";
import { svcIssueEnrollment } from "@/lib/services/admissions.service";
import { addAgentNote } from "@/lib/services/agents.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      applicant_name,
      college_id,
      course_id,
      session_id,
      agent_id,
      student_id,
      entry_type,
      joining_date,
      agent_paid_choice,
      agent_paid_remark,
      fee_structure,
      selected_fee_plan_id,
    } = body || {};

    if (!applicant_name || !college_id || !course_id || !session_id) {
      return NextResponse.json(
        {
          error:
            "applicant_name, college_id, course_id, session_id are required",
        },
        { status: 400 }
      );
    }
    const result = await svcIssueEnrollment({
      applicant_name,
      college_id,
      course_id,
      session_id,
      agent_id: agent_id ?? null,
      student_id: student_id ?? null,
      entry_type: entry_type ?? "regular",
      joining_date: joining_date ?? null,
      fee_structure: fee_structure ?? null,
      selected_fee_plan_id: selected_fee_plan_id ?? null,
    });
    // If agent is selected, persist an agent note with paid status
    if (
      agent_id &&
      (agent_paid_choice === "yes" || agent_paid_choice === "no")
    ) {
      await addAgentNote({
        agent_id,
        student_id: result.student_id,
        is_paid: agent_paid_choice === "yes",
        remarks:
          agent_paid_choice === "yes" && agent_paid_remark
            ? String(agent_paid_remark)
            : "",
      });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
