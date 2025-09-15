export type AdmissionStatus =
  | "NEW"
  | "REVIEW"
  | "PENDING_DOCS"
  | "APPROVED"
  | "REJECTED"
  | "ENROLLED";
export type AdmissionSource =
  | "WALK_IN"
  | "AGENT"
  | "ONLINE"
  | "REFERRAL"
  | "OTHER";

export interface AdmissionApplication {
  id: string;
  applicant_name: string;
  course_name: string;
  session_title?: string | null;
  status: AdmissionStatus;
  source: AdmissionSource;
  created_at: string; // ISO date
  updated_at: string; // ISO date
  enrollment_code?: string | null; // once converted
}
