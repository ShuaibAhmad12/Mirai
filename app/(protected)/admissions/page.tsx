import {
  AdmissionsFilters,
  AdmissionsStats,
  AdmissionsTable,
} from "@/components/admissions";
import type { AdmissionApplication } from "@/components/admissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
export const dynamic = "force-dynamic";

// Placeholder server actions / data fetchers to be integrated later.
async function fetchAdmissions(): Promise<AdmissionApplication[]> {
  // TODO: integrate real service (e.g., svcAdmissionsGrid)
  return [];
}

interface AdmissionsFilterOptions {
  colleges: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string; college_id?: string }>;
  sessions: Array<{ id: string; title: string }>;
}

async function fetchFilterOptions(): Promise<AdmissionsFilterOptions> {
  // TODO: integrate academic services if needed (colleges, courses, sessions)
  return { colleges: [], courses: [], sessions: [] };
}

export default async function AdmissionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === "string" ? sp.q : null;
  const status = typeof sp.status === "string" ? sp.status : null;
  const source = typeof sp.source === "string" ? sp.source : null;
  const page = typeof sp.page === "string" ? Math.max(1, Number(sp.page)) : 1;
  const limit = 20;
  // const offset = (page - 1) * limit; // reserved for future pagination in data fetch

  const [options, rows] = await Promise.all([
    fetchFilterOptions(),
    fetchAdmissions(),
  ]);

  const hasActiveFilter = Boolean(q || status || source);

  return (
    <div className="space-y-6">
      
      <AdmissionsStats rows={rows} />
      <AdmissionsFilters options={options} initial={{ q, status, source }} />
      <div className="flex justify-end mr-2">
        <Link href="/admissions/new">
          <Button type="button" >
            <Plus className="h-4 w-4" />
            Add Addmision
          </Button>
        </Link>
      </div>
      <AdmissionsTable rows={rows} />
      {/* Pagination placeholder */}
      <div className="flex items-center justify-end gap-2">
        <form method="get">
          <input type="hidden" name="q" value={q ?? ""} />
          <input type="hidden" name="status" value={status ?? ""} />
          <input type="hidden" name="source" value={source ?? ""} />
          <input type="hidden" name="page" value={Math.max(1, page - 1)} />
          <button
            className="text-sm px-3 py-1 border rounded"
            disabled={page <= 1}
          >
            Prev
          </button>
        </form>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <form method="get">
          <input type="hidden" name="q" value={q ?? ""} />
          <input type="hidden" name="status" value={status ?? ""} />
          <input type="hidden" name="source" value={source ?? ""} />
          <input type="hidden" name="page" value={page + 1} />
          <button
            className="text-sm px-3 py-1 border rounded"
            disabled={!hasActiveFilter || (rows?.length ?? 0) < limit}
          >
            Next
          </button>
        </form>
      </div>
    </div>
  );
}
