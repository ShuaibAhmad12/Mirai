// lib/types/students.ts
import type { UUID } from "./academic";

export interface StudentGridRow {
  student_id: UUID;
  full_name: string;
  enrollment_id: UUID;
  enrollment_code: string | null;
  father_name: string | null;
  mother_name: string | null;
  session_id: UUID | null;
  session_title: string | null;
  current_year: number | null;
  course_id: UUID | null;
  course_name: string | null;
  course_duration: number | null;
  college_id: UUID | null;
  college_name: string | null;
  college_code?: string | null;
  previous_balance: number | string | null;
  current_due: number | string | null;
  total_outstanding: number | string | null;
  last_payment_date: string | null; // ISO date
  last_payment_amount: number | string | null;
}
