// lib/services/academic.ts (server-only service layer)
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type {
  AcademicSession,
  College,
  Course,
  FeeComponent,
  FeePlan,
  FeePlanItem,
  FeePlanItemWithComponent,
  UUID,
} from "@/lib/types/academic";

// Define request types for service functions
type CreateCollegeRequest = Omit<
  College,
  | "id"
  | "legacy_id"
  | "created_at"
  | "updated_at"
  | "admission_number"
  | "status"
> & {
  admission_number?: number;
  code?: string | null;
  address?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  affiliation?: string | null;
  approved_by?: string | null;
  status?: number;
};

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // No-op: middleware is responsible for session refresh cookies
          void cookiesToSet;
        },
      },
    }
  );
}

// Colleges service
export async function svcListColleges(): Promise<College[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("colleges")
    .select(
      "id, code, name, admission_number, address, website, email, phone, affiliation, approved_by, status, created_at, updated_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function svcCreateCollege(
  data: CreateCollegeRequest
): Promise<College> {
  const supabase = await getServerSupabase();

  // Generate a legacy_id (using smaller number for PostgreSQL integer range)
  const legacy_id = Math.floor(Math.random() * 2000000000); // Max ~2 billion for PostgreSQL int

  const { data: college, error } = await supabase
    .from("colleges")
    .insert({
      ...data,
      legacy_id,
      admission_number: data.admission_number ?? 10000,
      status: data.status ?? 1,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating college:", error);
    throw error;
  }

  return college;
}

export async function svcUpdateCollege(
  id: UUID,
  patch: Partial<
    Pick<
      College,
      | "code"
      | "name"
      | "admission_number"
      | "address"
      | "website"
      | "email"
      | "phone"
      | "affiliation"
      | "approved_by"
      | "status"
    >
  >
): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("colleges").update(patch).eq("id", id);
  if (error) throw error;
}

export async function svcDeleteCollege(id: UUID): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("colleges").delete().eq("id", id);
  if (error) throw error;
}

// Courses service
export async function svcListCourses(): Promise<
  (Course & { college?: { name: string; code: string | null } })[]
> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, college_id, college_code, course_identity, name, duration, colleges:college_id(name, code)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Rel = { name: string; code: string | null } | Rel[] | null | undefined;
  // Supabase may return related table as single object or array depending on relationship
  const rows = (data ?? []) as unknown as (Course & { colleges?: Rel })[];
  return rows.map((r) => {
    const rel = r.colleges;
    const college = Array.isArray(rel)
      ? (rel[0] as { name: string; code: string | null } | undefined)
      : (rel as { name: string; code: string | null } | undefined);
    return { ...r, college: college ?? undefined };
  });
}

export async function svcCreateCourse(input: {
  college_id: UUID;
  college_code: string;
  course_identity: string;
  name: string;
  duration?: number | null;
}): Promise<{ id: UUID }> {
  const supabase = await getServerSupabase();
  const payload = {
    college_id: input.college_id,
    college_code: input.college_code,
    course_identity: input.course_identity,
    name: input.name,
    duration: input.duration ?? null,
  };
  const { data, error } = await supabase
    .from("courses")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: UUID };
}

export async function svcUpdateCourse(
  id: UUID,
  patch: Partial<Pick<Course, "course_identity" | "name" | "duration">>
): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("courses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function svcDeleteCourse(id: UUID): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
}

// Sessions service
export async function svcListSessions(): Promise<AcademicSession[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("academic_sessions")
    .select(
      "id, legacy_id, title, start_date, end_date, is_current, created_at, updated_at, updated_by"
    )
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function svcCreateSession(input: {
  title: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}): Promise<{ id: UUID }> {
  const supabase = await getServerSupabase();
  const payload = {
    legacy_id: Math.floor(Math.random() * 2000000000) + 1, // Generate random legacy_id
    title: input.title,
    start_date: input.start_date,
    end_date: input.end_date,
    is_current: input.is_current ?? false,
  };
  const { data, error } = await supabase
    .from("academic_sessions")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: UUID };
}

export async function svcUpdateSession(
  id: UUID,
  patch: Partial<
    Pick<AcademicSession, "title" | "start_date" | "end_date" | "is_current">
  >
): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("academic_sessions")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function svcDeleteSession(id: UUID): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("academic_sessions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Fees service
export async function svcListFeeComponents(): Promise<FeeComponent[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("fee_components")
    .select("id, code, label, frequency")
    .order("code");
  if (error) throw error;
  return data ?? [];
}

export async function svcListFeePlansByCourse(
  course_id: UUID,
  session_id?: UUID | null
): Promise<FeePlan[]> {
  const supabase = await getServerSupabase();
  let query = supabase
    .from("fee_plans")
    .select(
      "id, course_id, session_id, name, currency, status, effective_start, effective_end"
    )
    .eq("course_id", course_id)
    .order("created_at", { ascending: false });
  if (session_id) query = query.eq("session_id", session_id);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function svcCreateFeePlan(input: {
  course_id: UUID;
  session_id?: UUID | null;
  name: string;
  currency?: string;
}): Promise<{ id: UUID }> {
  const supabase = await getServerSupabase();
  const payload = {
    course_id: input.course_id,
    session_id: input.session_id ?? null,
    name: input.name,
    currency: input.currency ?? "INR",
    status: 1,
  };
  const { data, error } = await supabase
    .from("fee_plans")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: UUID };
}

export async function svcDeleteFeePlan(id: UUID): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("fee_plans").delete().eq("id", id);
  if (error) throw error;
}

export async function svcListFeePlanItems(
  fee_plan_id: UUID
): Promise<FeePlanItemWithComponent[]> {
  const supabase = await getServerSupabase();

  // First, get all fee components
  const { data: allComponents, error: componentsError } = await supabase
    .from("fee_components")
    .select("id, code, label, frequency")
    .order("code");

  if (componentsError) throw componentsError;

  // Then get existing fee plan items
  const { data: existingItems, error: itemsError } = await supabase
    .from("fee_plan_items")
    .select(
      `
      *,
      fee_components!inner(
        id,
        code,
        label,
        frequency
      )
    `
    )
    .eq("fee_plan_id", fee_plan_id)
    .order("year_number", { ascending: true })
    .order("fee_components(code)", { ascending: true });

  if (itemsError) throw itemsError;

  // Create a comprehensive list ensuring all components are represented
  const result: FeePlanItemWithComponent[] = [];
  const maxYear = Math.max(
    ...(existingItems || []).map((item) => item.year_number || 1),
    1
  );

  // For each year (1 to maxYear), ensure all components exist
  for (let year = 1; year <= maxYear; year++) {
    for (const component of allComponents || []) {
      // For one-time fees (SECURITY, OTHER), only create for Year 1
      const isOneTimeFee =
        component.code === "SECURITY" ||
        component.code === "OTHER" ||
        component.frequency === "one_time" ||
        component.frequency === "on_admission";

      if (isOneTimeFee && year > 1) {
        continue; // Skip creating placeholders for one-time fees in years > 1
      }

      // Check if this component/year combination exists
      const existingItem = existingItems?.find(
        (item) =>
          item.component_id === component.id && (item.year_number || 1) === year
      );

      if (existingItem) {
        // Use existing item
        result.push(existingItem);
      } else {
        // Create placeholder item with zero amount - use crypto.randomUUID() for proper UUID
        result.push({
          id: crypto.randomUUID(),
          fee_plan_id,
          component_id: component.id,
          year_number: year,
          amount: 0,
          is_admission_phase: false,
          notes: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: undefined,
          fee_components: component,
        });
      }
    }
  }

  return result;
}

export async function svcListAllFeePlanItems(): Promise<FeePlanItem[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("fee_plan_items")
    .select("*")
    .order("fee_plan_id", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function svcAddFeePlanItem(input: {
  fee_plan_id: UUID;
  component_id: UUID;
  amount: number;
  year_number?: number | null;
  is_admission_phase?: boolean;
  notes?: string | null;
}): Promise<{ id: UUID }> {
  const supabase = await getServerSupabase();

  // Validate that fee_plan_id exists
  const { data: feePlan, error: planError } = await supabase
    .from("fee_plans")
    .select("id")
    .eq("id", input.fee_plan_id)
    .single();

  if (planError || !feePlan) {
    throw new Error(`Fee plan with ID ${input.fee_plan_id} does not exist`);
  }

  // Validate that component_id exists
  const { data: component, error: componentError } = await supabase
    .from("fee_components")
    .select("id")
    .eq("id", input.component_id)
    .single();

  if (componentError || !component) {
    throw new Error(
      `Fee component with ID ${input.component_id} does not exist`
    );
  }

  const payload = {
    fee_plan_id: input.fee_plan_id,
    component_id: input.component_id,
    amount: input.amount,
    year_number: input.year_number ?? null,
    is_admission_phase: input.is_admission_phase ?? false,
    notes: input.notes ?? null,
  };

  console.log("Attempting to insert fee plan item:", payload);

  const { data, error } = await supabase
    .from("fee_plan_items")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    throw error;
  }

  console.log("Successfully created fee plan item:", data);
  return data as { id: UUID };
}

export async function svcDeleteFeePlanItem(id: UUID): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("fee_plan_items").delete().eq("id", id);
  if (error) throw error;
}

// Additional Fee Component CRUD functions
export async function svcCreateFeeComponent(input: {
  code: string;
  label: string;
  frequency: string;
  description?: string;
}): Promise<{ id: UUID }> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("fee_components")
    .insert({
      code: input.code,
      label: input.label,
      frequency: input.frequency,
      description: input.description,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function svcUpdateFeeComponent(
  id: UUID,
  input: {
    code?: string;
    label?: string;
    frequency?: string;
    description?: string;
  }
): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("fee_components")
    .update(input)
    .eq("id", id);
  if (error) throw error;
}

export async function svcDeleteFeeComponent(id: UUID): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("fee_components").delete().eq("id", id);
  if (error) throw error;
}

// Additional Fee Plan functions
export async function svcListAllFeePlans(): Promise<FeePlan[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("fee_plans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function svcUpdateFeePlan(
  id: UUID,
  input: {
    course_id?: UUID;
    session_id?: UUID | null;
    name?: string;
    currency?: string;
    status?: number;
    effective_start?: string;
    effective_end?: string;
  }
): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("fee_plans").update(input).eq("id", id);
  if (error) throw error;
}

// Additional Fee Plan Item functions
export async function svcUpdateFeePlanItem(
  id: UUID,
  input: {
    component_id?: UUID;
    amount?: number;
    year_number?: number | null;
    is_admission_phase?: boolean;
    notes?: string | null;
  }
): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("fee_plan_items")
    .update(input)
    .eq("id", id);
  if (error) throw error;
}
