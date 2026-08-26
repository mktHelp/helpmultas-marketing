"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { TaskFiltersBar } from "@/components/tasks/TaskFilters";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { createClient } from "@/lib/supabase/client";
import { listTasks, type TaskFilters } from "@/lib/services/tasks";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import type { TaskWithRelations } from "@/types/database";

export default function BoardPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const t = await listTasks(supabase, filters);
      setTasks(t);
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
        title="Quadro"
        description="Visualize e mova as tarefas entre as etapas de produção."
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
        <div className="py-16 text-center text-sm text-gray-400">Carregando quadro...</div>
      ) : (
        <KanbanBoard tasks={tasks} onRefresh={() => load(true)} />
      )}
      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => load(true)} />
    </div>
  );
}
