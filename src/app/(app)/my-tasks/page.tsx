"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { TaskTable } from "@/components/tasks/TaskTable";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { createClient } from "@/lib/supabase/client";
import { listTasks } from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { useAuth } from "@/lib/auth-context";
import type { Profile, TaskWithRelations } from "@/types/database";

export default function MyTasksPage() {
  const { profile, isManager } = useAuth();
  const supabase = createClient();
  const [tab, setTab] = useState("assigned");
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const [t, p] = await Promise.all([
      listTasks(supabase, tab === "assigned" ? { assignedTo: profile.id } : {}),
      listProfiles(supabase),
    ]);
    setTasks(tab === "created" ? t.filter((x) => x.created_by === profile.id) : t);
    setProfiles(p);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile?.id]);

  return (
    <div>
      <PageHeader
        title="Minhas Tarefas"
        description="Acompanhe as tarefas atribuídas e criadas por você."
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: "assigned", label: "Atribuídas a mim" },
            { key: "created", label: "Criadas por mim" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Carregando...</div>
      ) : (
        <TaskTable tasks={tasks} profiles={profiles} onRefresh={load} canDelete={isManager} />
      )}

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
