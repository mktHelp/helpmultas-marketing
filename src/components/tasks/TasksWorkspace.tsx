"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDot, Kanban, ListTodo, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar, FilterButton } from "@/components/ui/FilterBar";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { BoardFilterSidebar, countActiveFilters } from "./BoardFilterSidebar";
import { CreateTaskModal } from "./CreateTaskModal";
import { KanbanBoard } from "./KanbanBoard";
import { TaskCalendar } from "./TaskCalendar";
import { TaskTable } from "./TaskTable";
import { createClient } from "@/lib/supabase/client";
import { listTasks, type TaskFilters } from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { listAreas } from "@/lib/services/reference";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { useTaskStatuses } from "@/lib/task-status-context";
import { cn, isOverdue } from "@/lib/utils";
import type { Area, ContentType, Profile, TaskWithRelations } from "@/types/database";

const CONTENT_LABELS: Record<ContentType, string> = {
  reels: "Reels", stories: "Stories", feed: "Feed", carrossel: "Carrossel",
  youtube: "YouTube", blog: "Blog", email: "E-mail", whatsapp: "WhatsApp",
  anuncio: "Anúncio", landing_page: "Landing Page",
};

type View = "board" | "list" | "calendar";

const VIEWS: { value: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "board", label: "Quadro", icon: Kanban },
  { value: "list", label: "Lista", icon: ListTodo },
  { value: "calendar", label: "Calendário", icon: CalendarDays },
];

function parseView(v: string | null): View {
  return v === "list" || v === "calendar" ? v : "board";
}

/**
 * Tarefas: uma só tela com três formas de visualização (Quadro, Lista e Calendário).
 * Busca, filtros e criação são os mesmos nas três; o Quadro é o padrão.
 */
export function TasksWorkspace({ contentOnly = false }: { contentOnly?: boolean } = {}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));
  const { isManager } = useAuth();
  const { byKey } = useTaskStatuses();

  const [allTasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [contentType, setContentType] = useState("");
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
        setTasks(await listTasks(supabase, filters));
      } finally {
        setLoading(false);
      }
    },
    [supabase, filters]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    listProfiles(supabase).then(setProfiles).catch(() => {});
    listAreas(supabase).then(setAreas).catch(() => {});
  }, [supabase]);

  useRealtimeChanges(["tasks", "task_assignees"], () => load(true));

  // Em Conteúdos só entram tarefas com formato (Reels, Stories…); os chips filtram por formato.
  const contentTasks = useMemo(() => (contentOnly ? allTasks.filter((t) => t.content_type) : allTasks), [allTasks, contentOnly]);
  const tasks = useMemo(
    () => (contentOnly && contentType ? contentTasks.filter((t) => t.content_type === contentType) : contentTasks),
    [contentTasks, contentOnly, contentType]
  );
  const typeChips = useMemo(
    () =>
      (Object.keys(CONTENT_LABELS) as ContentType[])
        .map((key) => ({ key, label: CONTENT_LABELS[key], count: contentTasks.filter((t) => t.content_type === key).length }))
        .filter((c) => c.count > 0),
    [contentTasks]
  );

  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const activeCount = countActiveFilters(filters);

  function changeView(next: View) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "board") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

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

  const description = contentOnly
    ? "Reels, Stories, Blog, E-mail e demais formatos em produção."
    : view === "board"
      ? "Visualize e mova as tarefas entre as etapas de produção."
      : view === "list"
        ? "Gerencie todas as atividades do Marketing."
        : "Prazos, gravações e publicações do Marketing.";

  return (
    <div>
      <PageHeader
        title={contentOnly ? "Conteúdos" : "Tarefas"}
        description={description}
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> {contentOnly ? "Novo conteúdo" : "Nova tarefa"}
            </Button>
          </div>
        }
      />

      <div role="tablist" aria-label="Forma de visualização" className="mb-4 inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-[var(--shadow-sm)]">
        {VIEWS.map((v) => {
          const active = view === v.value;
          return (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => changeView(v.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95",
                active ? "bg-blue-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-050"
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {view === "list" && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={ListTodo} label={contentOnly ? "Conteúdos" : "Tarefas"} value={stats.total} hint={activeCount > 0 ? "com os filtros atuais" : "no total"} color="#375367" index={0} />
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
      )}

      <FilterBar>
        <SearchInput value={filters.search ?? ""} onChange={(v) => setFilters((f) => ({ ...f, search: v || undefined }))} placeholder={contentOnly ? "Buscar conteúdos…" : "Buscar tarefas…"} />
        <FilterButton count={activeCount} onClick={() => setFiltersOpen(true)} />
      </FilterBar>
      {contentOnly && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[{ key: "", label: "Todos", count: contentTasks.length }, ...typeChips].map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setContentType(c.key)}
              className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", contentType === c.key ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-700")}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      )}
      <ActiveFilterChips filters={filters} onChange={setFilters} profiles={profiles} areas={areas} />

      {loading && view !== "calendar" ? (
        view === "board" ? (
          <div className="flex h-[calc(100dvh-215px)] min-h-[420px] gap-4 overflow-hidden" role="status" aria-label="Carregando quadro">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="ast-skeleton h-full w-72 shrink-0 rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        ) : (
          <div className="space-y-2" role="status" aria-label="Carregando tarefas">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="ast-skeleton h-14 rounded-2xl" style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
        )
      ) : view === "board" ? (
        <KanbanBoard tasks={tasks} onRefresh={() => load(true)} />
      ) : view === "list" ? (
        <TaskTable tasks={tasks} profiles={profiles} onRefresh={() => load(true)} canDelete={isManager} />
      ) : (
        <TaskCalendar tasks={tasks} setTasks={setTasks} loading={loading} />
      )}

      {/* Filtros: gaveta à direita. Só aplica ao clicar em "Aplicar filtros". */}
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
