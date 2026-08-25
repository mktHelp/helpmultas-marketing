import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { AuthProvider } from "@/lib/auth-context";
import { TaskStatusProvider } from "@/lib/task-status-context";
import { AppShell } from "@/components/layout/AppShell";
import type { TaskStatusRow } from "@/types/database";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: statuses } = await supabase.from("task_statuses").select("*").order("sort_order");

  return (
    <AuthProvider initialProfile={profile}>
      <TaskStatusProvider initialStatuses={(statuses as TaskStatusRow[]) || []}>
        <AppShell>{children}</AppShell>
      </TaskStatusProvider>
    </AuthProvider>
  );
}
