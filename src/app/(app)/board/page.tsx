"use client";

import { useCallback, useEffect, useState } from "react";
import { ListFilter, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { Button } from "@/components/ui/Button";
import { BoardFilterSidebar, countActiveFilters } from "@/components/tasks/BoardFilterSidebar";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { createClient } from "@/lib/supabase/client";
import { listTasks, type TaskFilters } from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { listAreas } from "@/lib/services/reference";
import { ActiveFilterChips } from "@/components/tasks/ActiveFilterChips";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { cn } from "@/lib/utils";
import type { Area, Profile, TaskWithRelations } from "@/types/database";

export default function BoardPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const t = await listTasks(supabase, filters);
        setTasks(t);
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
    listProfiles(supabase).then(setProfiles).catch(() => {});
    listAreas(supabase).then(setAreas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["tasks", "task_assignees"], () => load(true));

  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const activeCount = countActiveFilters(filters);

  return (
    <div>
      <PageHeader
        title="Quadro"
        description="Visualize e mova as tarefas entre as etapas de produção."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border-2 px-4 font-display text-sm font-semibold transition-all active:scale-[0.97]",
                activeCount > 0
                  ? "border-blue-900 bg-blue-900 text-white hover:bg-blue-800"
                  : "border-blue-900 bg-white text-blue-900 hover:bg-blue-050"
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

      <ActiveFilterChips filters={filters} onChange={setFilters} profiles={profiles} areas={areas} />

      {loading ? (
        <div className="flex h-[calc(100dvh-215px)] min-h-[420px] gap-4 overflow-hidden" role="status" aria-label="Carregando quadro">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ast-skeleton h-full w-72 shrink-0 rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      ) : (
        <KanbanBoard tasks={tasks} onRefresh={() => load(true)} />
      )}

      {/* Filtros: gaveta à direita. Só aplica ao clicar em "Aplicar filtros". */}
      <RightDrawer open={filtersOpen} onClose={closeFilters} label="Filtros do quadro">
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
