"use client";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };
  return (
    <Button variant="outline" size="sm" onClick={logout}>
      <LogOut size={14} className="mr-1" /> Logout
    </Button>
  );
}
