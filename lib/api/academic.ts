// lib/api/academic.ts
"use client";

// Client API: uses Next.js API routes, not Supabase directly.
// Import and re-export shared types to avoid duplication.
import type {
  UUID,
  College,
  Course,
  AcademicSession,
  FeeComponent,
  FeePlan,
  FeePlanItem,
  FeePlanItemWithComponent,
} from "@/lib/types/academic";
export type {
  UUID,
  College,
  Course,
  AcademicSession,
  FeeComponent,
  FeePlan,
  FeePlanItem,
  FeePlanItemWithComponent,
} from "@/lib/types/academic";

// Note: client functions now call Next.js API routes; no direct Supabase usage here.

// Colleges
export async function listColleges(): Promise<College[]> {
  const res = await fetch("/api/academic/colleges", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list colleges: ${res.status}`);
  return (await res.json()) as College[];
}

export async function createCollege(input: {
  code?: string;
  name: string;
  admission_number?: number;
  address?: string;
  website?: string;
  email?: string;
  phone?: string;
  affiliation?: string;
  approved_by?: string;
  status?: number;
}) {
  const res = await fetch("/api/academic/colleges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create college: ${res.status}`);
  return (await res.json()) as { id: UUID };
}

export async function updateCollege(
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
) {
  const res = await fetch(`/api/academic/colleges/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update college: ${res.status}`);
}

export async function deleteCollege(id: UUID) {
  const res = await fetch(`/api/academic/colleges/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete college: ${res.status}`);
}

// Courses
export async function listCourses(): Promise<
  (Course & { college?: { name: string; code: string | null } })[]
> {
  const res = await fetch("/api/academic/courses", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list courses: ${res.status}`);
  return (await res.json()) as (Course & {
    college?: { name: string; code: string | null };
  })[];
}

export async function createCourse(input: {
  college_id: UUID;
  college_code: string;
  course_identity: string;
  name: string;
  duration?: number | null;
}) {
  const res = await fetch("/api/academic/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create course: ${res.status}`);
  return (await res.json()) as { id: UUID };
}

export async function updateCourse(
  id: UUID,
  patch: Partial<Pick<Course, "course_identity" | "name" | "duration">>
) {
  const res = await fetch(`/api/academic/courses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update course: ${res.status}`);
}

export async function deleteCourse(id: UUID) {
  const res = await fetch(`/api/academic/courses/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete course: ${res.status}`);
}

// Sessions
export async function listSessions(): Promise<AcademicSession[]> {
  const res = await fetch("/api/academic/sessions", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
  return (await res.json()) as AcademicSession[];
}

export async function createSession(input: {
  title: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}) {
  const res = await fetch("/api/academic/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return (await res.json()) as { id: UUID };
}

export async function updateSession(
  id: UUID,
  patch: Partial<
    Pick<AcademicSession, "title" | "start_date" | "end_date" | "is_current">
  >
) {
  const res = await fetch(`/api/academic/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update session: ${res.status}`);
}

export async function deleteSession(id: UUID) {
  const res = await fetch(`/api/academic/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`);
}

// Fees: components, plans, items
export async function listFeeComponents(): Promise<FeeComponent[]> {
  const res = await fetch("/api/academic/fee-components", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to list fee components: ${res.status}`);
  return (await res.json()) as FeeComponent[];
}

export async function createFeeComponent(input: {
  code: string;
  label: string;
  frequency: string;
  description?: string;
}): Promise<{ id: UUID }> {
  const res = await fetch("/api/academic/fee-components", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create fee component: ${res.status}`);
  return (await res.json()) as { id: UUID };
}

export async function updateFeeComponent(
  id: UUID,
  input: {
    code?: string;
    label?: string;
    frequency?: string;
    description?: string;
  }
): Promise<void> {
  const res = await fetch(`/api/academic/fee-components/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update fee component: ${res.status}`);
}

export async function deleteFeeComponent(id: UUID): Promise<void> {
  const res = await fetch(`/api/academic/fee-components/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete fee component: ${res.status}`);
}

export async function listAllFeePlans(): Promise<FeePlan[]> {
  const res = await fetch("/api/academic/fee-plans", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to list fee plans: ${res.status}`);
  return (await res.json()) as FeePlan[];
}

export async function listFeePlansByCourse(
  course_id: UUID,
  session_id?: UUID | null
): Promise<FeePlan[]> {
  const params = new URLSearchParams({ course_id });
  if (session_id) params.set("session_id", session_id);
  const res = await fetch(`/api/academic/fee-plans?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to list fee plans: ${res.status}`);
  return (await res.json()) as FeePlan[];
}

export async function createFeePlan(input: {
  course_id: UUID;
  session_id?: UUID | null;
  name: string;
  currency?: string;
  status?: number;
  effective_start?: string;
  effective_end?: string;
}): Promise<{ id: UUID }> {
  const res = await fetch("/api/academic/fee-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create fee plan: ${res.status}`);
  return (await res.json()) as { id: UUID };
}

export async function updateFeePlan(
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
  const res = await fetch(`/api/academic/fee-plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update fee plan: ${res.status}`);
}

export async function deleteFeePlan(id: UUID): Promise<void> {
  const res = await fetch(`/api/academic/fee-plans/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete fee plan: ${res.status}`);
}

export async function listFeePlanItems(
  fee_plan_id: UUID
): Promise<FeePlanItemWithComponent[]> {
  const res = await fetch(
    `/api/academic/fee-plan-items?fee_plan_id=${fee_plan_id}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to list fee plan items: ${res.status}`);
  return (await res.json()) as FeePlanItemWithComponent[];
}

export async function listAllFeePlanItems(): Promise<FeePlanItem[]> {
  const res = await fetch("/api/academic/fee-plan-items", {
    cache: "no-store",
  });
  if (!res.ok)
    throw new Error(`Failed to list all fee plan items: ${res.status}`);
  return (await res.json()) as FeePlanItem[];
}

export async function addFeePlanItem(input: {
  fee_plan_id: UUID;
  component_id: UUID;
  amount: number;
  year_number?: number | null;
  is_admission_phase?: boolean;
  notes?: string | null;
}): Promise<{ id: UUID }> {
  const res = await fetch("/api/academic/fee-plan-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to add fee plan item: ${res.status}`);
  return (await res.json()) as { id: UUID };
}

export async function updateFeePlanItem(
  id: UUID,
  input: {
    component_id?: UUID;
    amount?: number;
    year_number?: number | null;
    is_admission_phase?: boolean;
    notes?: string | null;
  }
): Promise<void> {
  const res = await fetch(`/api/academic/fee-plan-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update fee plan item: ${res.status}`);
}

export async function deleteFeePlanItem(id: UUID): Promise<void> {
  const res = await fetch(`/api/academic/fee-plan-items/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete fee plan item: ${res.status}`);
}
