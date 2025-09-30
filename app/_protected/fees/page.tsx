import { Suspense } from "react";
import {
  svcListColleges,
  svcListCourses,
  svcListSessions,
} from "@/lib/services/academic";
import { svcStudentsGrid } from "@/lib/services/students";
import { FeesFilters } from "../../../components/fees/FeesFilters";
import { FeesSummary } from "../../../components/fees/FeesSummary";
import { StudentsFeesTable } from "../../../components/fees/StudentsFeesTable";
import type { StudentGridRow } from "@/lib/types/students";

export const dynamic = "force-dynamic";

export default async function FeesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === "string" ? sp.q : null;
  const college_id =
    typeof sp.college_id === "string" &&
    sp.college_id !== "" &&
    sp.college_id !== "all"
      ? (sp.college_id as string)
      : null;
  const course_id =
    typeof sp.course_id === "string" &&
    sp.course_id !== "" &&
    sp.course_id !== "all"
      ? (sp.course_id as string)
      : null;
  const session_id =
    typeof sp.session_id === "string" &&
    sp.session_id !== "" &&
    sp.session_id !== "all"
      ? (sp.session_id as string)
      : null;
  const current_year =
    typeof sp.current_year === "string" &&
    sp.current_year !== "" &&
    sp.current_year !== "any"
      ? Number(sp.current_year)
      : null;
  const sort =
    sp.sort === "total_outstanding" || sp.sort === "current_due"
      ? (sp.sort as "total_outstanding" | "current_due")
      : "full_name";
  const order = sp.order === "desc" ? "desc" : "asc";
  const page = typeof sp.page === "string" ? Math.max(1, Number(sp.page)) : 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const hasActiveFilter = Boolean(
    q || college_id || course_id || session_id || current_year
  );

  const [colleges, courses, sessions] = await Promise.all([
    svcListColleges(),
    svcListCourses(),
    svcListSessions(),
  ]);

  const courseOptions = college_id
    ? courses.filter((c) => c.college_id === college_id)
    : courses;

  const rows: StudentGridRow[] = hasActiveFilter
    ? await svcStudentsGrid({
        q,
        college_id,
        course_id,
        session_id,
        current_year,
        sort,
        order,
        limit,
        offset,
      })
    : [];

  const totals = (() => {
    let prev = 0,
      due = 0;
    for (const r of rows) {
      const p =
        typeof r.previous_balance === "number"
          ? r.previous_balance
          : Number(r.previous_balance ?? 0);
      const d =
        typeof r.current_due === "number"
          ? r.current_due
          : Number(r.current_due ?? 0);
      if (isFinite(p)) prev += p;
      if (isFinite(d)) due += d;
    }
    return { prev, due, total: prev + due };
  })();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 flex h-[57px] items-center gap-1 border-b bg-background px-4">
        <h1 className="text-xl font-semibold">Fees</h1>
      </header>
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <FeesSummary totals={totals} count={(rows as unknown[]).length} />

        <FeesFilters
          q={q}
          college_id={college_id}
          course_id={course_id}
          session_id={session_id}
          current_year={current_year}
          sort={sort}
          order={order}
          colleges={colleges}
          courses={courseOptions}
          sessions={sessions}
        />

        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground">
              Loading students…
            </div>
          }
        >
          <StudentsFeesTable rows={rows} />
        </Suspense>

        <div className="flex items-center justify-end gap-2">
          <form method="get">
            <input type="hidden" name="q" value={q ?? ""} />
            <input
              type="hidden"
              name="college_id"
              value={college_id ?? "all"}
            />
            <input type="hidden" name="course_id" value={course_id ?? "all"} />
            <input
              type="hidden"
              name="session_id"
              value={session_id ?? "all"}
            />
            <input
              type="hidden"
              name="current_year"
              value={current_year ?? "any"}
            />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="order" value={order} />
            <input type="hidden" name="page" value={Math.max(1, page - 1)} />
            <button
              className="h-9 rounded-md border bg-background px-3 text-sm"
              disabled={page <= 1}
            >
              Previous
            </button>
          </form>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <form method="get">
            <input type="hidden" name="q" value={q ?? ""} />
            <input
              type="hidden"
              name="college_id"
              value={college_id ?? "all"}
            />
            <input type="hidden" name="course_id" value={course_id ?? "all"} />
            <input
              type="hidden"
              name="session_id"
              value={session_id ?? "all"}
            />
            <input
              type="hidden"
              name="current_year"
              value={current_year ?? "any"}
            />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="order" value={order} />
            <input type="hidden" name="page" value={page + 1} />
            <button
              className="h-9 rounded-md border bg-background px-3 text-sm"
              disabled={!hasActiveFilter || (rows?.length ?? 0) < limit}
            >
              Next
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
