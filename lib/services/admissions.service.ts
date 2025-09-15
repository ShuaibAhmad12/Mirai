// lib/services/admissions.service.ts (server-only)
import { createClient } from "@/lib/supabase/server";
import type { UUID } from "@/lib/types/academic";
import { formatEnrollmentCode, sessionFirstYear } from "@/lib/utils";

// Minimal list type for admissions page derived from students/enrollments.
export type AdmissionStatus =
  | "new"
  | "docs-pending"
  | "verified"
  | "approved"
  | "rejected"
  | "enrolled";

export type AdmissionSource = "walk-in" | "call" | "web" | "agent" | "other";

export interface AdmissionListRow {
  id: UUID; // enrollment id
  applicant_name: string; // student full_name
  course_name: string | null;
  session_title: string | null;
  status: AdmissionStatus; // always 'enrolled' for confirmed enrollments
  source: AdmissionSource; // inferred from presence of agent_id
  created_at: string; // enrollment created_at
  updated_at: string; // enrollment updated_at
  enrollment_code: string | null;
}

async function getServerSupabase() {
  return createClient();
}

// List admissions for grid
export async function svcListAdmissions(params?: {
  q?: string; // matches student name or enrollment_code
  status?: AdmissionStatus | "all"; // only 'enrolled' supported in this view
  source?: AdmissionSource | "all"; // inferred from agent presence
  limit?: number;
  offset?: number;
}): Promise<AdmissionListRow[]> {
  const supabase = await getServerSupabase();
  let query = supabase
    .from("student_enrollments")
    .select(
      `id, enrollment_code, created_at, updated_at, agent_id,
       students:student_id(full_name),
       courses:course_id(name),
       academic_sessions:session_id(title)`
    )
    .order("created_at", { ascending: false });

  if (params?.q) {
    const q = params.q.trim();
    // PostgREST: need separate filters; using or across computed cols isn't supported on joined cols; so filter on enrollment_code here
    query = query.or(`enrollment_code.ilike.%${q}%`);
  }
  // Basic pagination (optional)
  if (typeof params?.limit === "number" && typeof params?.offset === "number") {
    query = query.range(params.offset, params.offset + params.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  type JoinedRow = {
    id: UUID;
    enrollment_code: string | null;
    created_at: string;
    updated_at: string;
    agent_id: UUID | null;
    students?:
      | { full_name: string | null }
      | Array<{ full_name: string | null }>
      | null;
    courses?: { name: string | null } | Array<{ name: string | null }> | null;
    academic_sessions?:
      | { title: string | null }
      | Array<{ title: string | null }>
      | null;
  };
  const rows = (data || []) as JoinedRow[];
  // Map into AdmissionListRow (defensively handle array vs object nested joins)
  const mapped: AdmissionListRow[] = rows.map((r) => {
    const student = Array.isArray(r.students) ? r.students?.[0] : r.students;
    const course = Array.isArray(r.courses) ? r.courses?.[0] : r.courses;
    const session = Array.isArray(r.academic_sessions)
      ? r.academic_sessions?.[0]
      : r.academic_sessions;
    return {
      id: r.id as UUID,
      applicant_name: (student?.full_name as string | null) || "",
      course_name: (course?.name as string | null) || null,
      session_title: (session?.title as string | null) || null,
      status: "enrolled",
      source: r.agent_id ? "agent" : "other",
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      enrollment_code: (r.enrollment_code as string | null) ?? null,
    };
  });

  if (params?.q) {
    const q = params.q.trim().toLowerCase();
    return mapped.filter(
      (m) =>
        m.applicant_name.toLowerCase().includes(q) ||
        (m.enrollment_code ?? "").toLowerCase().includes(q)
    );
  }
  return mapped;
}

export async function svcIssueEnrollment(input: {
  applicant_name: string;
  college_id: UUID;
  course_id: UUID;
  session_id: UUID;
  agent_id?: UUID | null;
  student_id?: UUID | null; // reuse when converting an existing student
  entry_type?: "regular" | "lateral";
  joining_date?: string | null; // ISO date
  fee_structure?: Array<{
    id: string;
    component_name: string;
    component_code: string;
    year_number: number;
    course_fee: number;
    discount: number;
    actual_fee: number;
    is_placeholder?: boolean;
  }> | null;
  selected_fee_plan_id?: UUID | null;
}): Promise<{
  enrollment_id: UUID;
  enrollment_code: string;
  student_id: UUID;
}> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("fn_issue_enrollment", {
    p_applicant_name: input.applicant_name,
    p_college_id: input.college_id,
    p_course_id: input.course_id,
    p_session_id: input.session_id,
    p_agent_id: input.agent_id ?? null,
    p_student_id: input.student_id ?? null,
    p_entry_type: input.entry_type ?? "regular",
    p_joining_date: input.joining_date ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const result = row as {
    enrollment_id: UUID;
    enrollment_code: string;
    student_id: UUID;
  };

  // Create fee overrides and balances if fee structure is provided
  if (input.fee_structure && input.fee_structure.length > 0) {
    // Get current user for created_by field
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    // Get session details for academic year calculation
    const { data: sessionData } = await supabase
      .from("academic_sessions")
      .select("title, start_date, end_date")
      .eq("id", input.session_id)
      .single();

    const currentYear = new Date().getFullYear();
    const academicYear = sessionData
      ? `${new Date(sessionData.start_date).getFullYear()}-${String(
          new Date(sessionData.end_date).getFullYear()
        ).slice(-2)}`
      : `${currentYear}-${String(currentYear + 1).slice(-2)}`;

    // Get fee_component_id for each fee plan item to create proper balances
    const feeItemIds = input.fee_structure
      .filter((item) => !item.is_placeholder)
      .map((item) => item.id);

    const { data: feeItemsWithComponents } = await supabase
      .from("fee_plan_items")
      .select(
        `
        id,
        component_id,
        fee_components!inner(id, code, label)
      `
      )
      .in("id", feeItemIds);

    for (const feeItem of input.fee_structure) {
      // Skip placeholder items UNLESS it's a lateral entry Year 1 fee that needs to be zeroed
      const isLateralEntry = input.entry_type === "lateral";
      const isYear1 = feeItem.year_number === 1;
      const shouldProcessPlaceholder =
        isLateralEntry && isYear1 && feeItem.is_placeholder;

      if (feeItem.is_placeholder && !shouldProcessPlaceholder) continue;

      // Don't skip zero amount items - SECURITY/OTHER fees start at 0 but can have additions

      // Find the component_id for this fee plan item
      const feeItemData = feeItemsWithComponents?.find(
        (item) => item.id === feeItem.id
      );
      if (!feeItemData) {
        console.warn(`Fee plan item ${feeItem.id} not found, skipping`);
        continue;
      }

      // Determine if this is SECURITY/OTHER (addition) or TUITION/ADMISSION (discount)
      const isAdditionalFee =
        feeItem.component_code === "SECURITY" ||
        feeItem.component_code === "OTHER";

      // For lateral entry, year 1 fees should be zero
      const shouldZeroOut = isLateralEntry && isYear1;

      // For SECURITY/OTHER: The service double-subtracts discounts, so we need to adjust
      // For TUITION/ADMISSION: Store normally but ensure no double discount

      // The fees service has this logic:
      // 1. Start with override_amount
      // 2. Then subtract discount_amount
      // This causes double discount for normal fees and wrong calculation for SECURITY/OTHER

      // Solution: Set override_amount to final amount, and discount_amount to 0 to prevent double calculation
      const finalOverrideAmount = shouldZeroOut ? 0 : feeItem.actual_fee;
      const storeDiscountAmount = 0; // Don't store discount to prevent double calculation

      // Determine reason for the override
      let reason: string;
      if (shouldZeroOut) {
        reason = `Lateral entry student - Year ${feeItem.year_number} fee waived`;
      } else if (isAdditionalFee) {
        reason = `Added ₹${feeItem.discount} to base amount during admission`;
      } else {
        reason = `Discounted ₹${feeItem.discount} from base amount during admission`;
      }

      // Insert fee override for each customized fee amount
      const { error: feeError } = await supabase
        .from("student_fee_overrides")
        .insert({
          enrollment_id: result.enrollment_id,
          fee_plan_item_id: feeItem.id,
          component_code: feeItem.component_code,
          year_number: feeItem.year_number, // Add the missing year_number
          override_amount: finalOverrideAmount,
          discount_amount: storeDiscountAmount,
          reason: reason,
          source: isLateralEntry
            ? "lateral_entry_admission"
            : "admission_wizard",
          created_by: currentUserId,
        });

      if (feeError) {
        console.error("Error creating fee override:", feeError);
        continue; // Continue with other items
      }

      // Create entry in fee_current_balances for immediate visibility in student profile
      // This should show the final amounts without double-calculating discounts
      const { error: balanceError } = await supabase
        .from("fee_current_balances")
        .insert({
          enrollment_id: result.enrollment_id,
          academic_year: academicYear,
          fee_component_id: feeItemData.component_id,
          component_code: feeItem.component_code,
          component_name: feeItem.component_name,
          year_number: feeItem.year_number,
          original_amount: shouldZeroOut ? 0 : feeItem.course_fee,
          override_amount: finalOverrideAmount, // This is the final amount student should pay
          discount_amount: shouldZeroOut
            ? 0
            : isAdditionalFee
            ? 0
            : feeItem.discount, // Store actual discount only for TUITION/ADMISSION, zero for lateral entry
          charged_amount: finalOverrideAmount, // What student owes
          paid_amount: 0,
          outstanding_amount: finalOverrideAmount,
          source_system: isLateralEntry
            ? "lateral_entry_admission"
            : "admission_wizard",
        });

      if (balanceError) {
        console.error("Error creating fee balance:", balanceError);
        // Continue with other items, don't fail the entire admission
      }
    }

    // Set fee_plan_id in enrollment if provided
    if (input.selected_fee_plan_id) {
      const { error: updateError } = await supabase
        .from("student_enrollments")
        .update({
          fee_plan_id: input.selected_fee_plan_id,
        })
        .eq("id", result.enrollment_id);

      if (updateError) {
        console.error("Error setting fee plan:", updateError);
      }
    }
  }

  // Create initial student progression record with correct year based on entry type
  const { error: progressionError } = await supabase
    .from("student_progressions")
    .insert({
      enrollment_id: result.enrollment_id,
      from_year: null, // First admission
      to_year: input.entry_type === "lateral" ? 2 : 1, // Year 2 for lateral, Year 1 for regular
      effective_date:
        input.joining_date || new Date().toISOString().split("T")[0],
      status: "new_admission",
      notes:
        input.entry_type === "lateral"
          ? "Lateral entry admission - starting in year 2"
          : "Initial admission progression record",
    });

  if (progressionError) {
    console.error("Error creating progression record:", progressionError);
    // Don't fail admission for this
  }

  return result;
}

// Preview-only helper (no increment): compute what the code would be now for a specific target
export async function svcPreviewEnrollmentCodeFor(input: {
  college_id: UUID;
  session_id: UUID;
}): Promise<{ enrollment_code: string }> {
  const supabase = await getServerSupabase();
  // Select independently to avoid complex joins via PostgREST
  const { data: college, error: cErr } = await supabase
    .from("colleges")
    .select("code, admission_number")
    .eq("id", input.college_id)
    .single();
  if (cErr) throw cErr;
  const { data: session, error: sErr } = await supabase
    .from("academic_sessions")
    .select("title, start_date")
    .eq("id", input.session_id)
    .single();
  if (sErr) throw sErr;
  const firstYear = sessionFirstYear(session?.title, session?.start_date);
  return {
    enrollment_code: formatEnrollmentCode(
      (college as { code: string | null } | null)?.code ?? null,
      (college as { admission_number: number } | null)?.admission_number ??
        10000,
      firstYear
    ),
  };
}
