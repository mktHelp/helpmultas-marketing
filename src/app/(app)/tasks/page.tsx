"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDot, ListFilter, ListTodo, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { ActiveFilterChips } from "@/components/tasks/ActiveFilterChips";
import { BoardFilterSidebar, countActiveFilters } from "@/components/tasks/BoardFilterSidebar";
import { TaskTable } from "@/components/tasks/TaskTable";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { createClient } from "@/lib/supabase/client";
import { listTasks, type TaskFilters } from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { listAreas } from "@/lib/services/reference";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { useTaskStatuses } from "@/lib/task-status-context";
import { cn, isOverdue } from "@/lib/utils";
import type { Area, Profile, TaskWithRelations } from "@/types/database";

export default function AllTasksPage() {
  const { isManager } = useAuth();
  const { byKey } = useTaskStatuses();
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [t, p] = await Promise.all([listTasks(supabase, filters), listProfiles(supabase)]);
        setTasks(t);
        setProfiles(p);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    listAreas(supabase).then(setAreas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["tasks", "task_assignees"], () => load(true));

  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const activeCount = countActiveFilters(filters);

  const stats = useMemo(() => {
    let open = 0;
    let overdue = 0;
    let done = 0;
    for (const t of tasks) {
      const st = byKey[t.status];
      if (st?.is_done) done++;
      else if (!st?.is_cancelled) {
        open++;
        if (isOverdue(t.due_date, t.completed_at)) overdue++;
      }
    }
    return { total: tasks.length, open, overdue, done };
  }, [tasks, byKey]);

  return (
    <div>
      <PageHeader
        title="Todas as Tarefas"
        description="Gerencie todas as atividades do Marketing."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border-2 px-4 font-display text-sm font-semibold transition-all active:scale-[0.97]",
                activeCount > 0 ? "border-blue-900 bg-blue-900 text-white hover:bg-blue-800" : "border-blue-900 bg-white text-blue-900 hover:bg-blue-050"
              )}
            >
              <ListFilter className="h-4 w-4" />
              Filtros
              {activeCount > 0 && (
                <span key={activeCount} className="ast-pop rounded-full bg-yellow-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-blue-900">
                  {activeCount}
                </span>
              )}
            </button>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ListTodo} label="Tarefas" value={stats.total} hint={activeCount > 0 ? "com os filtros atuais" : "no total"} color="#375367" index={0} />
        <StatCard icon={CircleDot} label="Em aberto" value={stats.open} color="#e0a900" index={1} />
        <StatCard
          icon={AlertTriangle}
          label="Atrasadas"
          value={stats.overdue}
          color="#c23b3b"
          index={2}
          active={!!filters.onlyOverdue}
          onClick={() => setFilters((f) => ({ ...f, onlyOverdue: f.onlyOverdue ? undefined : true }))}
          hint={filters.onlyOverdue ? "clique para remover o filtro" : "clique para filtrar"}
        />
        <StatCard icon={CheckCircle2} label="Concluídas" value={stats.done} color="#2f8f5b" index={3} />
      </div>

      <ActiveFilterChips filters={filters} onChange={setFilters} profiles={profiles} areas={areas} />

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Carregando tarefas">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ast-skeleton h-14 rounded-2xl" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      ) : (
        <TaskTable tasks={tasks} profiles={profiles} onRefresh={() => load(true)} canDelete={isManager} />
      )}

      <RightDrawer open={filtersOpen} onClose={closeFilters} label="Filtros das tarefas">
        <BoardFilterSidebar
          applied={filters}
          resultCount={tasks.length}
          onClose={closeFilters}
          onApply={(next) => {
            setFilters(next);
            setFiltersOpen(false);
          }}
        />
      </RightDrawer>

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => load(true)} />
    </div>
  );
}
