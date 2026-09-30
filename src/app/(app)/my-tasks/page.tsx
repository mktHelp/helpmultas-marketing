"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { MyTasksDashboard } from "@/components/tasks/MyTasksDashboard";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { createClient } from "@/lib/supabase/client";
import { listTasks } from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import type { Profile, TaskWithRelations } from "@/types/database";

export default function MyTasksPage() {
  const { profile, isManager } = useAuth();
  const supabase = createClient();
  const [tab, setTab] = useState("assigned");
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  // Só a primeira carga mostra "Carregando": ao trocar de aba o painel continua
  // montado, preservando filtros e a visão escolhida.
  const [ready, setReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(
    async () => {
      if (!profile) return;
      const [t, p] = await Promise.all([
        listTasks(supabase, tab === "assigned" ? { assignedTo: [profile.id] } : {}),
        listProfiles(supabase),
      ]);
      setTasks(tab === "created" ? t.filter((x) => x.created_by === profile.id) : t);
      setProfiles(p);
      setReady(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, profile?.id]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile?.id]);

  useRealtimeChanges(["tasks", "task_assignees"], () => load());

  return (
    <div>
      <PageHeader
        title="Minhas Tarefas"
        description="Sua central pessoal: o que fazer agora, o que está atrasado e o que você já entregou."
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        }
      />

      {!ready ? (
        <div className="py-16 text-center text-sm text-gray-400">Carregando...</div>
      ) : (
        <MyTasksDashboard
          tasks={tasks}
          profiles={profiles}
          tab={tab}
          onTabChange={setTab}
          onRefresh={() => load()}
          canDelete={isManager}
        />
      )}

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => load()} />
    </div>
  );
}
