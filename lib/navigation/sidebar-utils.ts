// Sidebar Navigation Configuration Utilities
// This file provides utilities for managing navigation items with RBAC

import { COMMON_PERMISSIONS, COMMON_ROLES } from "@/lib/rbac/types";

// Navigation item interface with permission requirements
export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiredPermissions?: readonly string[];
  requiredRoles?: readonly string[];
  adminOnly?: boolean;
  description?: string;
}

// Navigation group interface
export interface NavGroup {
  title: string;
  items: NavItem[];
  icon?: React.ElementType;
}

// Utility function to check if user can access a navigation item
export function canAccessNavItem(
  item: NavItem,
  userPermissions: {
    hasPermission: (resource: string, operation: string) => boolean;
    hasRole: (role: string) => boolean;
    isAdmin: () => boolean;
  }
): boolean {
  const { hasPermission, hasRole, isAdmin } = userPermissions;

  // Admin bypass - admins can access everything
  if (isAdmin()) return true;

  // If admin only, check if user is admin
  if (item.adminOnly) return false;

  // Check required permissions
  if (item.requiredPermissions && item.requiredPermissions.length > 0) {
    const hasRequiredPermission = item.requiredPermissions.some(
      (permission: string) => {
        const [resource, operation] = permission.split(":");
        return hasPermission(resource, operation);
      }
    );
    if (!hasRequiredPermission) return false;
  }

  // Check required roles
  if (item.requiredRoles && item.requiredRoles.length > 0) {
    const hasRequiredRole = item.requiredRoles.some((role: string) =>
      hasRole(role)
    );
    if (!hasRequiredRole) return false;
  }

  return true;
}

// Helper function to create permission-based nav items
export function createNavItem(
  label: string,
  href: string,
  icon: React.ElementType,
  options: {
    permissions?: readonly string[];
    roles?: readonly string[];
    adminOnly?: boolean;
    description?: string;
  } = {}
): NavItem {
  return {
    label,
    href,
    icon,
    requiredPermissions: options.permissions,
    requiredRoles: options.roles,
    adminOnly: options.adminOnly,
    description: options.description,
  };
}

// Pre-defined permission combinations for common scenarios
export const NAVIGATION_PERMISSIONS = {
  // Academic Management
  ACADEMIC_READ: [COMMON_PERMISSIONS.STUDENTS_READ],
  ACADEMIC_MANAGE: [
    COMMON_PERMISSIONS.STUDENTS_CREATE,
    COMMON_PERMISSIONS.STUDENTS_UPDATE,
  ],

  // Fee Management
  FEES_READ: [COMMON_PERMISSIONS.FEES_READ],
  FEES_MANAGE: [COMMON_PERMISSIONS.FEES_CREATE, COMMON_PERMISSIONS.FEES_UPDATE],
  FEES_APPROVE: [COMMON_PERMISSIONS.FEES_APPROVE],

  // Staff Management
  STAFF_READ: [COMMON_PERMISSIONS.STAFF_READ],
  STAFF_MANAGE: [
    COMMON_PERMISSIONS.STAFF_CREATE,
    COMMON_PERMISSIONS.STAFF_UPDATE,
  ],

  // System Administration
  SYSTEM_ADMIN: [COMMON_PERMISSIONS.SYSTEM_ADMIN],
  USER_MANAGEMENT: [COMMON_PERMISSIONS.USER_MANAGEMENT],
  REPORTS_VIEW: [COMMON_PERMISSIONS.REPORTS_VIEW],
} as const;

// Pre-defined role combinations for common scenarios
export const NAVIGATION_ROLES = {
  ACADEMIC_STAFF: [
    COMMON_ROLES.FACULTY,
    COMMON_ROLES.ADMIN,
    COMMON_ROLES.SUPER_ADMIN,
  ],
  FINANCE_STAFF: [
    COMMON_ROLES.ACCOUNTANT,
    COMMON_ROLES.ADMIN,
    COMMON_ROLES.SUPER_ADMIN,
  ],
  ADMIN_STAFF: [COMMON_ROLES.ADMIN, COMMON_ROLES.SUPER_ADMIN],
  ALL_STAFF: [
    COMMON_ROLES.STAFF,
    COMMON_ROLES.FACULTY,
    COMMON_ROLES.ACCOUNTANT,
    COMMON_ROLES.ADMIN,
    COMMON_ROLES.SUPER_ADMIN,
  ],
} as const;

// Example usage:
// const academicNavItem = createNavItem(
//   "Academic Management",
//   "/academic-management",
//   GraduationCap,
//   {
//     permissions: NAVIGATION_PERMISSIONS.ACADEMIC_READ,
//     roles: NAVIGATION_ROLES.ACADEMIC_STAFF,
//     description: "Manage students, courses, and academic records"
//   }
// );
