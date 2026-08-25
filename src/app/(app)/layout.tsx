import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthProvider } from "@/lib/auth-context";
import { TaskStatusProvider } from "@/lib/task-status-context";
import { AppShell } from "@/components/layout/AppShell";
import type { Profile, TaskStatusRow } from "@/types/database";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: statuses }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("task_statuses").select("*").order("sort_order"),
  ]);

  return (
    <AuthProvider initialProfile={profile as Profile | null}>
      <TaskStatusProvider initialStatuses={(statuses as TaskStatusRow[]) || []}>
        <AppShell>{children}</AppShell>
      </TaskStatusProvider>
    </AuthProvider>
  );
}
