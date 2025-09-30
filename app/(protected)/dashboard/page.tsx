import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/auth/login");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Academic Mgmt", href: "/academic-management", count: 0 },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border p-4 bg-card">
            <div className="text-sm text-foreground/60">{c.label}</div>
            <div className="text-3xl font-bold mt-2">{c.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
