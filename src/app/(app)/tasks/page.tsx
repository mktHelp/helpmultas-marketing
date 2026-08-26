"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { TaskFiltersBar } from "@/components/tasks/TaskFilters";
import { TaskTable } from "@/components/tasks/TaskTable";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { createClient } from "@/lib/supabase/client";
import { listTasks, type TaskFilters } from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import type { Profile, TaskWithRelations } from "@/types/database";

export default function AllTasksPage() {
  const { isManager } = useAuth();
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const [t, p] = await Promise.all([listTasks(supabase, filters), listProfiles(supabase)]);
      setTasks(t);
      setProfiles(p);
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useRealtimeChanges(["tasks", "task_assignees"], () => load(true));

  return (
    <div>
      <PageHeader
        title="Todas as Tarefas"
        description="Gerencie todas as atividades do Marketing."
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        }
      />

      <div className="mb-4">
        <TaskFiltersBar filters={filters} onChange={setFilters} />
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Carregando tarefas...</div>
      ) : (
        <TaskTable tasks={tasks} profiles={profiles} onRefresh={() => load(true)} canDelete={isManager} />
      )}

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => load(true)} />
    </div>
  );
}
