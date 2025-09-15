// Example usage of the simplified RBAC system
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  PermissionGate,
  AdminGate,
  useAuth,
} from "@/lib/providers/auth-provider";
import { COMMON_PERMISSIONS } from "@/lib/rbac/types";

// Example 1: Using the auth store directly
function StudentManagementPage() {
  const { hasPermission, canManageStudents, isAdmin } = useAuthStore();

  // Check specific permissions
  const canCreate = hasPermission(COMMON_PERMISSIONS.STUDENTS_CREATE);
  const canUpdate = hasPermission(COMMON_PERMISSIONS.STUDENTS_UPDATE);

  return (
    <div>
      <h1>Student Management</h1>

      {canCreate && <button>Create Student</button>}

      {canUpdate && <button>Edit Students</button>}

      {isAdmin() && <button>Admin Actions</button>}

      {canManageStudents() && <div>Student management features available</div>}
    </div>
  );
}

// Example 2: Using permission gates
function StudentListWithGates() {
  return (
    <div>
      <h1>Students</h1>

      {/* Only show create button if user has permission */}
      <PermissionGate resource="STUDENTS" operation="CREATE">
        <button className="btn btn-primary">Create New Student</button>
      </PermissionGate>

      {/* Admin-only features */}
      <AdminGate>
        <div className="admin-panel">
          <h2>Admin Controls</h2>
          <button>Bulk Import</button>
          <button>System Settings</button>
        </div>
      </AdminGate>

      {/* Student list */}
      <PermissionGate resource="STUDENTS" operation="READ">
        <div className="student-list">{/* Student list content */}</div>
      </PermissionGate>

      {/* Fee management for students */}
      <PermissionGate
        resource="FEES"
        operation="READ"
        fallback={<div>You don&apos;t have permission to view fees</div>}
      >
        <div className="fee-section">Fee information and management</div>
      </PermissionGate>
    </div>
  );
}

// Example 3: Using the auth context
function UserProfile() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Please log in</div>;

  return (
    <div>
      <h1>Welcome, {user.full_name}</h1>
      <p>Email: {user.email}</p>
      <p>Roles: {user.roles.join(", ")}</p>

      {user.is_system_admin && (
        <div className="admin-badge">System Administrator</div>
      )}
    </div>
  );
}

// Example 4: Loading permissions on login
import { getCurrentUserWithPermissions } from "@/lib/api/user-permissions";

async function handleLogin() {
  const { setUser, setLoading } = useAuthStore.getState();

  setLoading(true);
  try {
    const userWithPermissions = await getCurrentUserWithPermissions();
    setUser(userWithPermissions);
  } catch (error) {
    console.error("Failed to load user permissions:", error);
  } finally {
    setLoading(false);
  }
}

export {
  StudentManagementPage,
  StudentListWithGates,
  UserProfile,
  handleLogin,
};
