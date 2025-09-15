import type { AdmissionApplication } from "./AdmissionsTypes";

interface AdmissionsStatsProps {
  rows: AdmissionApplication[];
}

export function AdmissionsStats({ rows }: AdmissionsStatsProps) {
  const total = rows.length;
  const pendingDocs = rows.filter((r) => r.status === "PENDING_DOCS").length;
  const approved = rows.filter((r) => r.status === "APPROVED").length;
  const enrolled = rows.filter((r) => r.status === "ENROLLED").length;
  const conversionRate = total ? Math.round((enrolled / total) * 100) : 0;

  const Card = ({
    label,
    value,
    accent,
  }: {
    label: string;
    value: string | number;
    accent?: string;
  }) => (
    <div className="rounded-lg border p-4 bg-card text-card-foreground">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={`mt-2 text-xl font-semibold ${accent || ""}`}>
        {value}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card label="Total" value={total} />
      <Card label="Pending Docs" value={pendingDocs} />
      <Card label="Approved" value={approved} />
      <Card label="Enrolled" value={enrolled} />
      <Card label="Conversion" value={`${conversionRate}%`} />
    </div>
  );
}
