// Example usage in any page: app/(protected)/students/page.tsx
"use client";

import {
  useAuth,
  PermissionGate,
  AdminGate,
} from "@/lib/providers/auth-provider";

export default function StudentsPage() {
  const { user, hasPermission, isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Students Management</h1>

        <PermissionGate
          resource="STUDENTS"
          operation="CREATE"
          fallback={
            <p className="text-muted-foreground">
              No permission to add students
            </p>
          }
        >
          <button className="bg-blue-500 text-white px-4 py-2 rounded">
            Add New Student
          </button>
        </PermissionGate>
      </div>

      {/* Student List */}
      <PermissionGate resource="STUDENTS" operation="READ">
        <div className="bg-white p-4 rounded border">
          <h2>Student List</h2>
          {/* Your student list here */}
        </div>
      </PermissionGate>

      {/* Admin Only Section */}
      <AdminGate fallback={<p>Admin access required</p>}>
        <div className="bg-red-50 p-4 rounded border">
          <h3>Admin Controls</h3>
          <p>Only admins can see this section</p>
        </div>
      </AdminGate>

      {/* Conditional rendering using hooks */}
      {hasPermission("STUDENTS", "DELETE") && (
        <div className="bg-yellow-50 p-4 rounded border">
          <h3>Danger Zone</h3>
          <button className="bg-red-500 text-white px-4 py-2 rounded">
            Delete Selected Students
          </button>
        </div>
      )}

      {/* User info */}
      <div className="bg-gray-50 p-4 rounded">
        <p>Welcome, {user?.full_name}</p>
        <p>Admin: {isAdmin() ? "Yes" : "No"}</p>
        <p>Roles: {user?.roles?.join(", ")}</p>
      </div>
    </div>
  );
}

/*
  That's it! Super simple usage:
  
  1. useAuth() hook for permission checks
  2. <PermissionGate> for conditional rendering
  3. <AdminGate> for admin-only content
  4. All permissions loaded once and cached
  5. No complex service layers or multiple files
  
  Just 3 files total:
  - auth-store.ts (Zustand store)
  - user-permissions.ts (API call)
  - auth-provider.tsx (Provider + components)
*/
