import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

// Enrollment helpers
// Derive the first year of an academic session. Prefer startDate year, fallback to parsing title like "2024-2025".
export function sessionFirstYear(
  title?: string | null,
  startDate?: string | null
): number {
  if (startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) return d.getUTCFullYear();
  }
  if (title) {
    const m = title.match(/(\d{4})\s*[-/]/);
    if (m) return Number(m[1]);
    const onlyYear = title.match(/\b(\d{4})\b/);
    if (onlyYear) return Number(onlyYear[1]);
  }
  return new Date().getUTCFullYear();
}

export function formatEnrollmentCode(
  collegeCode: string | null | undefined,
  admissionNumber: number,
  firstYear: number
): string {
  const code = (collegeCode || "").toString().trim().toUpperCase();
  return `${code}/${admissionNumber}/${firstYear}`;
}
