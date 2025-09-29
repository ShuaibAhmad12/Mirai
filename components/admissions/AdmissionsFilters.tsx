"use client";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AdmissionStatus, AdmissionSource } from "./AdmissionsTypes";

interface AdmissionsFiltersProps {
  initial: { q: string | null; status: string | null; source: string | null };
  options: {
    statuses?: AdmissionStatus[];
    sources?: AdmissionSource[];
    colleges?: Array<{ id: string; name: string }>;
    courses?: Array<{ id: string; name: string; college_id?: string }>;
    sessions?: Array<{ id: string; title: string }>;
  };
}

export function AdmissionsFilters({
  initial,
  options,
}: AdmissionsFiltersProps) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground">
      <form method="get" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="col-span-1 lg:col-span-2">
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              name="q"
              placeholder="Name or contact"
              className="mt-1"
              defaultValue={initial.q ?? ""}
            />
          </div>
          <div className="col-span-1">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={initial.status ?? ""}
            >
              <option value="">All</option>
              {(
                options.statuses || [
                  "NEW",
                  "REVIEW",
                  "PENDING_DOCS",
                  "APPROVED",
                  "REJECTED",
                  "ENROLLED",
                ]
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <Label htmlFor="source">Source</Label>
            <select
              id="source"
              name="source"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={initial.source ?? ""}
            >
              <option value="">All</option>
              {(
                options.sources || [
                  "WALK_IN",
                  "AGENT",
                  "ONLINE",
                  "REFERRAL",
                  "OTHER",
                ]
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {/* Future: college/course/session filters */}
          <div className="flex items-center mt-5 ml-4 justify-between">
            <a
              href="/admissions"
              className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              Reset filters
            </a>
          </div>
          <div className="flex justify-end items-center mt-5">
            <Button type="submit">Apply</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
