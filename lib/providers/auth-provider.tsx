// lib/providers/auth-provider.tsx
"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
import { useAuthStore, User } from "@/lib/stores/auth-store";
import { getCurrentUserWithPermissions } from "@/lib/api/user-permissions";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  hasPermission: (resource: string, operation: string) => boolean;
  hasRole: (role: string) => boolean;
  isAdmin: () => boolean;
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    isLoading,
    setUser,
    setLoading,
    hasPermission: storeHasPermission,
    hasRole,
    isAdmin,
  } = useAuthStore();
  const supabase = createClient();

  // Load user permissions on mount
  useEffect(() => {
    let mounted = true;

    async function loadUserPermissions() {
      if (!mounted) return;
      setLoading(true);
      try {
        const userWithPermissions = await getCurrentUserWithPermissions();
        if (mounted) setUser(userWithPermissions);
      } catch (error) {
        console.error("Failed to load user permissions:", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    // Check if user is authenticated
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!mounted) return;
      if (authUser) {
        // Only load if we don't already have user data
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          loadUserPermissions();
        } else {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session?.user) {
        await loadUserPermissions();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setLoading, supabase.auth]);

  // Helper function for permission checking
  const hasPermission = (resource: string, operation: string) => {
    return storeHasPermission(`${resource}:${operation}`);
  };

  return (
    <AuthContext.Provider
      value={{
        hasPermission,
        hasRole,
        isAdmin,
        user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Simple permission checking components
export function PermissionGate({
  resource,
  operation,
  fallback = null,
  children,
}: {
  resource: string;
  operation: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission } = useAuth();

  if (!hasPermission(resource, operation)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function AdminGate({
  fallback = null,
  children,
}: {
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { isAdmin } = useAuth();

  if (!isAdmin()) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
