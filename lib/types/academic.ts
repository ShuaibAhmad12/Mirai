// lib/types/academic.ts
export type UUID = string;

export interface College {
  id: UUID;
  legacy_id?: number;
  code: string | null;
  name: string;
  admission_number: number; // running admission counter, default 10000
  address?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  affiliation?: string | null;
  approved_by?: string | null;
  status: number; // 0/1
  created_at?: string;
  updated_at?: string;
  updated_by?: string | null;
}

export interface Course {
  id: UUID;
  college_id: UUID;
  college_code: string;
  course_identity: string;
  name: string;
  duration: number | null;
}

export interface AcademicSession {
  id: UUID;
  legacy_id: number;
  title: string;
  start_date: string; // date
  end_date: string; // date
  is_current: boolean;
  created_at: string;
  updated_at: string;
  updated_by: UUID | null;
}

export interface FeeComponent {
  id: UUID;
  code: string;
  label: string;
  frequency: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: UUID;
}

export interface FeePlan {
  id: UUID;
  legacy_id?: number;
  course_id: UUID;
  session_id: UUID | null;
  name: string;
  currency: string;
  status: number; // 0/1
  effective_start: string;
  effective_end?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: UUID;
}

export interface FeePlanItem {
  id: UUID;
  fee_plan_id: UUID;
  component_id: UUID;
  year_number: number | null;
  amount: number;
  is_admission_phase: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: UUID;
}

// Extended type for FeePlanItem with joined fee component data
export interface FeePlanItemWithComponent extends FeePlanItem {
  fee_components: FeeComponent;
}
