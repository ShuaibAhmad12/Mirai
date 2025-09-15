# RBAC (Role-Based Access Control)

This folder contains the essential types for the Alpine Education System's RBAC implementation.

## Files

- `types.ts` - Essential TypeScript types and constants for RBAC

## Implementation

The RBAC system has been simplified to use:

1. **Zustand Store** (`/lib/stores/auth-store.ts`) - For caching user permissions and roles
2. **API Service** (`/lib/api/user-permissions.ts`) - For loading user data with permissions
3. **Auth Provider** (`/lib/providers/auth-provider.tsx`) - For wrapping the app with permission context

## Usage

```typescript
import { useAuthStore } from "@/lib/stores/auth-store";
import { COMMON_PERMISSIONS, COMMON_ROLES } from "@/lib/rbac/types";

// In your component
const { hasPermission, hasRole, isAdmin } = useAuthStore();

// Check permissions
if (hasPermission(COMMON_PERMISSIONS.STUDENTS_READ)) {
  // Show students list
}

// Check roles
if (hasRole(COMMON_ROLES.SUPER_ADMIN)) {
  // Show admin features
}
```

## Protected Components

Use the permission components from the AuthProvider:

```tsx
import { PermissionGate, AdminGate } from '@/lib/providers/auth-provider'

<PermissionGate permission={COMMON_PERMISSIONS.STUDENTS_CREATE}>
  <CreateStudentButton />
</PermissionGate>

<AdminGate>
  <AdminPanel />
</AdminGate>
```

This simplified approach replaces the previous complex service-layer implementation with a cleaner provider pattern.
