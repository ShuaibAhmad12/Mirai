import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/components/logout-button";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AutoBreadCrumbs } from "@/components/layout/auto-breadcrumbs";
import { AuthProvider } from "@/lib/providers/auth-provider";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex-1 flex flex-col min-h-screen">
            <header className="h-14 border-b flex items-center justify-between px-4 gap-4 sticky top-0 bg-background">
              <SidebarTrigger />
              <div className="font-semibold tracking-tight">Dashboard</div>
              <div className="flex items-center gap-3">
                <ThemeSwitcher />
                <LogoutButton />
              </div>
            </header>
            <div>
              <AutoBreadCrumbs />
              <main className="flex-1 p-6 overflow-y-auto">{children}</main>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}
