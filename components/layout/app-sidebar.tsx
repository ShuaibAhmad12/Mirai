"use client";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  Wallet,
  Users,
  UserCog,
  Settings,
  FileText,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "../ui/sidebar";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  NavGroup,
  canAccessNavItem,
  createNavItem,
  NAVIGATION_PERMISSIONS,
  NAVIGATION_ROLES,
} from "@/lib/navigation/sidebar-utils";

// Navigation configuration using the utility functions
const navigationConfig: NavGroup[] = [
  {
    title: "Overview",
    items: [
      createNavItem("Dashboard", "/dashboard", LayoutDashboard, {
        description: "Main dashboard overview",
      }),
    ],
  },
  {
    title: "Academic",
    items: [
      createNavItem(
        "Academic Management",
        "/academic-management",
        GraduationCap,
        {
          permissions: NAVIGATION_PERMISSIONS.ACADEMIC_READ,
          roles: NAVIGATION_ROLES.ACADEMIC_STAFF,
          description: "Manage students, courses, and academic records",
        }
      ),
      createNavItem("Students", "/students", Users, {
        permissions: NAVIGATION_PERMISSIONS.ACADEMIC_READ,
        roles: NAVIGATION_ROLES.ACADEMIC_STAFF,
        description: "Browse and filter student information",
      }),
      createNavItem("Admissions", "/admissions", Users, {
        permissions: NAVIGATION_PERMISSIONS.ACADEMIC_READ,
        roles: NAVIGATION_ROLES.ACADEMIC_STAFF,
        description: "Manage applicant pipeline and intake",
      }),
    ],
  },
  {
    title: "Operations",
    items: [
      createNavItem("Fees", "/fees", Wallet, {
        permissions: NAVIGATION_PERMISSIONS.FEES_READ,
        roles: NAVIGATION_ROLES.FINANCE_STAFF,
        description: "Fee management and billing",
      }),
      createNavItem("Staff", "/staff", Users, {
        permissions: NAVIGATION_PERMISSIONS.STAFF_READ,
        roles: NAVIGATION_ROLES.ADMIN_STAFF,
        description: "Staff management and records",
      }),
      createNavItem("Agents", "/agents", UserCog, {
        permissions: NAVIGATION_PERMISSIONS.USER_MANAGEMENT,
        roles: NAVIGATION_ROLES.ADMIN_STAFF,
        description: "Agent management system",
      }),
    ],
  },
  {
    title: "Administration",
    items: [
      createNavItem("Reports", "/reports", FileText, {
        permissions: NAVIGATION_PERMISSIONS.REPORTS_VIEW,
        roles: NAVIGATION_ROLES.ADMIN_STAFF,
        description: "Insights and exportable reports",
      }),
      createNavItem("Settings", "/settings", Settings, {
        adminOnly: true,
        description: "System settings and configuration",
      }),
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { hasPermission, hasRole, isAdmin, user, isLoading } = useAuth();

  // Filter navigation groups to only include items the user can access
  const getFilteredNavGroups = (): NavGroup[] => {
    // Always show basic navigation, filter based on permissions if user is loaded
    return navigationConfig
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          // If no user loaded yet, show basic navigation items (Dashboard)
          if (!user) {
            return item.href === "/dashboard";
          }
          // If user is loaded, filter based on permissions
          return canAccessNavItem(item, { hasPermission, hasRole, isAdmin });
        }),
      }))
      .filter((group) => group.items.length > 0); // Only include groups that have items
  };

  const filteredNavGroups = getFilteredNavGroups();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="p-4">
          <div className="font-semibold">Alpine Education</div>
          <div className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading..."
              : user
              ? `Welcome, ${user.first_name}`
              : "User"}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Create a SidebarGroup for each navigation group */}
        {filteredNavGroups.length > 0 ? (
          filteredNavGroups.map((group) => (
            <SidebarGroup key={group.title}>
              {group.items.length > 3 && (
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </div>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname.startsWith(item.href)}
                        >
                          <a
                            href={item.href}
                            className="flex items-center gap-2"
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : isLoading ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="p-4 text-center text-muted-foreground">
                <div className="animate-pulse">Loading navigation...</div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="p-4 text-center text-muted-foreground">
                <div>No accessible navigation items</div>
                <div className="text-xs mt-1">Contact admin for access</div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
