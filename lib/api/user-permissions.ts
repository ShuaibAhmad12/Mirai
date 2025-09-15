// lib/api/user-permissions.ts
import { createClient } from "@/lib/supabase/client";

export interface UserWithPermissions {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_system_admin: boolean;
  roles: string[];
  permissions: string[];
}

export async function getCurrentUserWithPermissions(): Promise<UserWithPermissions | null> {
  const supabase = createClient();

  try {
    // Get current authenticated user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("Auth error:", authError);
      return null;
    }

    // Get user with roles and permissions
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select(
        `
        id,
        email,
        first_name,
        last_name,
        full_name,
        is_system_admin,
        user_roles!user_roles_user_id_fkey!inner(
          role_id,
          roles!inner(
            name,
            role_permissions(
              permissions(
                resource_type,
                operation
              )
            )
          )
        )
      `
      )
      .eq("supabase_auth_id", authUser.id)
      .eq("user_roles.is_active", true)
      .eq("user_roles.roles.is_active", true)
      .single();

    if (userError || !userData) {
      console.error("User data error:", userError);
      return null;
    }

    // Extract roles and permissions with proper error handling
    const roles: string[] = [];
    const permissions = new Set<string>();

    if (userData.user_roles && Array.isArray(userData.user_roles)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userData.user_roles.forEach((userRole: any) => {
        if (userRole.roles && userRole.roles.name) {
          roles.push(userRole.roles.name);

          // Extract permissions from role
          if (
            userRole.roles.role_permissions &&
            Array.isArray(userRole.roles.role_permissions)
          ) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userRole.roles.role_permissions.forEach((rolePermission: any) => {
              if (
                rolePermission.permissions &&
                rolePermission.permissions.resource_type &&
                rolePermission.permissions.operation
              ) {
                permissions.add(
                  `${rolePermission.permissions.resource_type}:${rolePermission.permissions.operation}`
                );
              }
            });
          }
        }
      });
    }

    return {
      id: userData.id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      full_name: userData.full_name,
      is_system_admin: userData.is_system_admin,
      roles,
      permissions: Array.from(permissions),
    };
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return null;
  }
}
