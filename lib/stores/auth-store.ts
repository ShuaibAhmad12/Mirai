// lib/stores/auth-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { COMMON_PERMISSIONS, COMMON_ROLES } from "@/lib/rbac/types";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_system_admin: boolean;
  roles: string[];
  permissions: string[];
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  isAdmin: () => boolean;
  canManageStudents: () => boolean;
  canManageStaff: () => boolean;
  canManageFees: () => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,

      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),

      hasPermission: (permission) => {
        const { user } = get();
        return (
          user?.permissions?.includes(permission) ||
          user?.is_system_admin ||
          false
        );
      },

      hasRole: (role) => {
        const { user } = get();
        return user?.roles?.includes(role) || user?.is_system_admin || false;
      },

      isAdmin: () => {
        const { user } = get();
        return (
          user?.is_system_admin ||
          user?.roles?.includes(COMMON_ROLES.SUPER_ADMIN) ||
          false
        );
      },

      canManageStudents: () => {
        const { user } = get();
        return (
          user?.permissions?.includes(COMMON_PERMISSIONS.STUDENTS_CREATE) ||
          user?.permissions?.includes(COMMON_PERMISSIONS.STUDENTS_UPDATE) ||
          user?.is_system_admin ||
          false
        );
      },

      canManageStaff: () => {
        const { user } = get();
        return (
          user?.permissions?.includes(COMMON_PERMISSIONS.STAFF_CREATE) ||
          user?.permissions?.includes(COMMON_PERMISSIONS.STAFF_UPDATE) ||
          user?.is_system_admin ||
          false
        );
      },

      canManageFees: () => {
        const { user } = get();
        return (
          user?.permissions?.includes(COMMON_PERMISSIONS.FEES_CREATE) ||
          user?.permissions?.includes(COMMON_PERMISSIONS.FEES_UPDATE) ||
          user?.permissions?.includes(COMMON_PERMISSIONS.FEES_APPROVE) ||
          user?.is_system_admin ||
          false
        );
      },

      logout: () => set({ user: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
