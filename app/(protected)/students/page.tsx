import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudentsTable } from "@/components/students/students-table";
import {
  svcListColleges,
  svcListCourses,
  svcListSessions,
} from "@/lib/services/academic";
import { svcStudentsGrid } from "@/lib/services/students";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === "string" ? sp.q : null;
  const college_id =
    typeof sp.college_id === "string" && sp.college_id !== ""
      ? (sp.college_id as string)
      : null;
  const course_id =
    typeof sp.course_id === "string" && sp.course_id !== ""
      ? (sp.course_id as string)
      : null;
  const session_id =
    typeof sp.session_id === "string" && sp.session_id !== ""
      ? (sp.session_id as string)
      : null;
  const current_year =
    typeof sp.current_year === "string" && sp.current_year !== ""
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

  // Fetch filter options server-side. We'll wire table data later.
  const [colleges, courses, sessions] = await Promise.all([
    svcListColleges(),
    svcListCourses(),
    svcListSessions(),
  ]);

  const years = ["1", "2", "3", "4", "5"]; // current year options

  // Fetch rows for current filters
  const rows = await svcStudentsGrid({
    q,
    college_id,
    course_id,
    session_id,
    current_year,
    sort,
    order,
    limit,
    offset,
  });


  // Filter courses by selected college to reduce options (UX improvement)
  const courseOptions = college_id
    ? courses.filter((c) => c.college_id === college_id)
    : courses;

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground">
        <form method="get" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <div className="col-span-1 lg:col-span-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                name="q"
                placeholder="Search by name or enrollment"
                className="mt-1"
                defaultValue={q ?? ""}
              />
            </div>
            <div className="col-span-1">
              <Label htmlFor="college">College</Label>
              <select
                id="college"
                name="college_id"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue={college_id ?? ""}
              >
                <option value="">All</option>
                {colleges.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <Label htmlFor="course">Course</Label>
              <select
                id="course"
                name="course_id"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue={course_id ?? ""}
              >
                <option value="">All</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <Label htmlFor="session">Session</Label>
              <select
                id="session"
                name="session_id"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue={session_id ?? ""}
              >
                <option value="">All</option>
                {sessions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <Label htmlFor="year">Current Year</Label>
              <select
                id="year"
                name="current_year"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue={current_year ? String(current_year) : ""}
              >
                <option value="">Any</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <Label htmlFor="sort">Sort</Label>
              <select
                id="sort"
                name="sort"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue={sort}
              >
                <option value="full_name">Name</option>
                <option value="current_due">Current Due</option>
                <option value="total_outstanding">Total Outstanding</option>
              </select>
            </div>
            <div className="col-span-1">
              <Label htmlFor="order">Order</Label>
              <select
                id="order"
                name="order"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue={order}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
            <div className="flex justify-between ">
              <div className="flex items-center mt-5">
                <Link
                  href="/students"
                  className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                >
                  Reset filters
                </Link>
              </div>
              <div className="flex items-center mt-5 ">
                <Button type="submit" variant="default">
                  Apply
                </Button>
              </div>
            </div>
          </div>
          {/* Reset page on apply */}
          <input type="hidden" name="page" value={1} />
        </form>
      </div>

      {/* Data Table with right-drawer customization */}
      <StudentsTable rows={rows as unknown as Array<Record<string, unknown>>} />

      {/* Simple pagination controls (URL-based in a follow-up) */}
      <div className="flex items-center justify-end gap-2">
        <form method="get">
          <input type="hidden" name="q" value={q ?? ""} />
          <input type="hidden" name="college_id" value={college_id ?? ""} />
          <input type="hidden" name="course_id" value={course_id ?? ""} />
          <input type="hidden" name="session_id" value={session_id ?? ""} />
          <input type="hidden" name="current_year" value={current_year ?? ""} />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="order" value={order} />
          <input type="hidden" name="page" value={Math.max(1, page - 1)} />
          <Button type="submit" variant="outline" disabled={page <= 1}>
            Previous
          </Button>
        </form>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <form method="get">
          <input type="hidden" name="q" value={q ?? ""} />
          <input type="hidden" name="college_id" value={college_id ?? ""} />
          <input type="hidden" name="course_id" value={course_id ?? ""} />
          <input type="hidden" name="session_id" value={session_id ?? ""} />
          <input type="hidden" name="current_year" value={current_year ?? ""} />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="order" value={order} />
          <input type="hidden" name="page" value={page + 1} />
          <Button
            type="submit"
            variant="outline"
            disabled={!hasActiveFilter || (rows?.length ?? 0) < limit}
          >
            Next
          </Button>
        </form>
      </div>
    </div>
  );
}
