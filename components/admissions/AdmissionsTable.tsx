"use client";
import * as React from "react";
import type { AdmissionApplication } from "./AdmissionsTypes";
import { useRouter } from "next/navigation";

interface AdmissionsTableProps {
  rows: AdmissionApplication[];
}

export function AdmissionsTable({ rows }: AdmissionsTableProps) {
  const router = useRouter();
  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2 text-left">Applicant</th>
            <th className="px-3 py-2 text-left">Course</th>
            <th className="px-3 py-2 text-left">Session</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-left">Applied</th>
            <th className="px-3 py-2 text-left">Enrollment</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-8 text-center text-muted-foreground text-sm"
              >
                No applications yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b last:border-b-0 hover:bg-muted/20"
            >
              <td className="px-3 py-2 font-medium">{r.applicant_name}</td>
              <td className="px-3 py-2">{r.course_name}</td>
              <td className="px-3 py-2">{r.session_title || "-"}</td>
              <td className="px-3 py-2">
                <span className="inline-block rounded bg-secondary px-2 py-0.5 text-xs">
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{r.source}</td>
              <td className="px-3 py-2 text-xs">
                {new Date(r.created_at).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 text-xs font-mono">
                {r.enrollment_code || "-"}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => router.push(`/admissions/${r.id}`)}
                  className="text-xs underline underline-offset-2 hover:text-primary"
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
