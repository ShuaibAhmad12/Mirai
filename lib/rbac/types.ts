// Essential RBAC Types for Alpine Education System
// Simplified for use with Zustand store and provider pattern

export type UserStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING_VERIFICATION"
  | "LOCKED"
  | "EXPIRED";

export type PermissionOperation =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "EXPORT"
  | "IMPORT"
  | "BULK_UPDATE"
  | "REPORT_VIEW"
  | "ADMIN_ACCESS";

export type ResourceType =
  | "STUDENTS"
  | "STAFF"
  | "COURSES"
  | "FEES"
  | "ADMISSIONS"
  | "ACADEMIC_SESSIONS"
  | "REPORTS"
  | "USER_MANAGEMENT"
  | "SYSTEM_SETTINGS"
  | "AUDIT_LOGS"
  | "NOTIFICATIONS"
  | "ASSESSMENTS"
  | "ATTENDANCE"
  | "LIBRARY"
  | "HOSTELS"
  | "TRANSPORT"
  | "INVENTORY";

export type ScopeLevel =
  | "GLOBAL"
  | "COLLEGE"
  | "DEPARTMENT"
  | "COURSE"
  | "SELF";

export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "VISITING"
  | "EMERITUS"
  | "INTERN";

export type DepartmentType =
  | "ACADEMIC"
  | "ADMINISTRATION"
  | "FINANCE"
  | "HR"
  | "IT"
  | "LIBRARY"
  | "HOSTELS"
  | "TRANSPORT"
  | "MAINTENANCE"
  | "SECURITY";

// Simplified interfaces for basic database entities
export interface DbUser {
  id: string;
  email: string;
  phone?: string;
  username?: string;
  supabase_auth_id?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  status: UserStatus;
  is_system_admin: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  email_verified_at?: string;
}

export interface DbRole {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  level: number;
  is_system_role: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbPermission {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  resource_type: ResourceType;
  operation: PermissionOperation;
  scope_level: ScopeLevel;
  is_system_permission: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Permission helper types
export type PermissionString = `${ResourceType}:${PermissionOperation}`;

// Common permission combinations
export const COMMON_PERMISSIONS = {
  // Students
  STUDENTS_READ: "STUDENTS:READ" as PermissionString,
  STUDENTS_CREATE: "STUDENTS:CREATE" as PermissionString,
  STUDENTS_UPDATE: "STUDENTS:UPDATE" as PermissionString,
  STUDENTS_DELETE: "STUDENTS:DELETE" as PermissionString,

  // Staff
  STAFF_READ: "STAFF:READ" as PermissionString,
  STAFF_CREATE: "STAFF:CREATE" as PermissionString,
  STAFF_UPDATE: "STAFF:UPDATE" as PermissionString,
  STAFF_DELETE: "STAFF:DELETE" as PermissionString,

  // Fees
  FEES_READ: "FEES:READ" as PermissionString,
  FEES_CREATE: "FEES:CREATE" as PermissionString,
  FEES_UPDATE: "FEES:UPDATE" as PermissionString,
  FEES_APPROVE: "FEES:APPROVE" as PermissionString,

  // System
  SYSTEM_ADMIN: "SYSTEM_SETTINGS:ADMIN_ACCESS" as PermissionString,
  USER_MANAGEMENT: "USER_MANAGEMENT:ADMIN_ACCESS" as PermissionString,
  REPORTS_VIEW: "REPORTS:REPORT_VIEW" as PermissionString,
} as const;

// Common role names
export const COMMON_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  FACULTY: "FACULTY",
  ACCOUNTANT: "ACCOUNTANT",
  VIEWER: "VIEWER",
} as const;
