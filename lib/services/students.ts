// lib/services/students.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { UUID } from "@/lib/types/academic";
import type { StudentGridRow } from "@/lib/types/students";

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

export type StudentsGridParams = {
  q?: string | null;
  college_id?: UUID | null;
  course_id?: UUID | null;
  session_id?: UUID | null;
  current_year?: number | null;
  sort?: "full_name" | "total_outstanding" | "current_due";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export async function svcStudentsGrid(params: StudentsGridParams) {
  const supabase = await getServerSupabase();

  const {
    q = null,
    college_id = null,
    course_id = null,
    session_id = null,
    current_year = null,
    sort = "full_name",
    order = "asc",
    limit = 20,
    offset = 0,
  } = params || {};

  const { data, error } = await supabase.rpc("rpc_students_grid_live", {
    p_q: q,
    p_college_id: college_id,
    p_course_id: course_id,
    p_session_id: session_id,
    p_current_year: current_year,
    p_sort: sort,
    p_order: order,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return (data ?? []) as StudentGridRow[];
}
