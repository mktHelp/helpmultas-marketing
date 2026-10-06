import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { AuthProvider } from "@/lib/auth-context";
import { TaskStatusProvider } from "@/lib/task-status-context";
import { ExpansionShell } from "@/components/expansion/ExpansionHeader";
import { HelpinhoWidget } from "@/components/assistant/HelpinhoWidget";
import type { TaskStatusRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Criativos — Expansão Help Multas",
};

// Standalone dashboard for the expansion team: requires login but lives
// outside the (app) shell, so there's no sidebar into the rest of the hub.
// Os providers e o Helpinho (chat fixo em /expansao/assistente + flutuante)
// são os mesmos do Hub; só a criação de tarefas fica desligada aqui.
export default async function ExpansionLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/login?redirectTo=/expansao");

  const supabase = await createClient();
  const { data: statuses } = await supabase.from("task_statuses").select("*").order("sort_order");

  return (
    <AuthProvider initialProfile={profile}>
      <TaskStatusProvider initialStatuses={(statuses as TaskStatusRow[]) || []}>
        <div className="bg-gray-100/50 print:bg-white">
          <ExpansionShell userName={profile?.full_name ?? ""} canReturnToHub={profile?.role !== "expansao"}>
            {children}
          </ExpansionShell>
          <HelpinhoWidget />
        </div>
      </TaskStatusProvider>
    </AuthProvider>
  );
}
