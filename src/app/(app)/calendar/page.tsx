"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, CalendarCheck, CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Inbox, ListFilter, Palette, X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { PriorityBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { TASK_COLORS, TaskColorPicker } from "@/components/tasks/TaskColorPicker";
import { createClient } from "@/lib/supabase/client";
import { listTasks, updateTask } from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { listAreas } from "@/lib/services/reference";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { useTaskStatuses } from "@/lib/task-status-context";
import { cn, isOverdue } from "@/lib/utils";
import type { Area, Profile, TaskWithRelations } from "@/types/database";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "#7c8e98" },
  { value: "media", label: "Média", color: "#4a6a80" },
  { value: "alta", label: "Alta", color: "#e0a900" },
  { value: "urgente", label: "Urgente", color: "#c23b3b" },
];

interface CalFilters {
  search: string;
  assignees: string[];
  statuses: string[];
  priorities: string[];
  areas: string[];
  colors: string[];
  onlyOverdue: boolean;
}

const NO_FILTERS: CalFilters = { search: "", assignees: [], statuses: [], priorities: [], areas: [], colors: [], onlyOverdue: false };
const NO_COLOR = "none";

function toggleIn(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function FilterChip({ label, color, selected, onClick }: { label: string; color?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95",
        selected ? "border-transparent bg-blue-900 text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-050"
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function CalendarPage() {
  const supabase = createClient();
  const { byKey, statuses } = useTaskStatuses();
  const { profile } = useAuth();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CalFilters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [colorOpenId, setColorOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    listTasks(supabase, {})
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    listProfiles(supabase).then(setProfiles).catch(() => {});
    listAreas(supabase).then(setAreas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["tasks", "task_assignees"], load);

  const mine = !!profile && filters.assignees.length === 1 && filters.assignees[0] === profile.id;
  const activeCount =
    (filters.search.trim() ? 1 : 0) + (filters.assignees.length ? 1 : 0) + (filters.statuses.length ? 1 : 0) +
    (filters.priorities.length ? 1 : 0) + (filters.areas.length ? 1 : 0) + (filters.colors.length ? 1 : 0) +
    (filters.onlyOverdue ? 1 : 0);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (filters.assignees.length && !t.assignees?.some((a) => filters.assignees.includes(a.id))) return false;
      if (filters.statuses.length && !filters.statuses.includes(t.status)) return false;
      if (filters.priorities.length && !filters.priorities.includes(t.priority)) return false;
      if (filters.areas.length && !(t.area_id && filters.areas.includes(t.area_id))) return false;
      if (filters.colors.length && !filters.colors.includes(t.color?.toLowerCase() ?? NO_COLOR)) return false;
      if (filters.onlyOverdue && !isOverdue(t.due_date, t.completed_at)) return false;
      return true;
    });
  }, [tasks, filters]);

  // Troca a cor direto pelo calendário: atualiza na hora e desfaz se o salvamento falhar.
  async function changeColor(id: string, color: string | null) {
    const previous = tasks.find((t) => t.id === id)?.color ?? null;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, color } : t)));
    try {
      await updateTask(supabase, id, { color });
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, color: previous } : t)));
      toast.error("Não foi possível alterar a cor");
    }
  }

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  // Agrupa as tarefas por dia uma única vez (evita refiltrar a lista inteira em cada célula).
  const byDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    for (const t of filtered) {
      if (!t.due_date) continue;
      const key = format(parseISO(t.due_date), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [filtered]);

  const tasksOn = useCallback((day: Date) => byDay.get(format(day, "yyyy-MM-dd")) ?? [], [byDay]);

  const stats = useMemo(() => {
    let inMonth = 0;
    let overdue = 0;
    let doneInMonth = 0;
    let today = 0;
    for (const t of filtered) {
      if (!t.due_date) continue;
      const due = parseISO(t.due_date);
      const done = !!byKey[t.status]?.is_done;
      if (isToday(due) && !done) today++;
      if (!isSameMonth(due, month)) continue;
      inMonth++;
      if (done) doneInMonth++;
      else if (isOverdue(t.due_date, t.completed_at)) overdue++;
    }
    return { inMonth, overdue, doneInMonth, today };
  }, [filtered, byKey, month]);

  function goToday() {
    const now = new Date();
    setMonth(now);
    setSelected(now);
  }

  const selectedTasks = tasksOn(selected);

  // Cor escolhida na tarefa tem prioridade; sem ela, vale a cor da etapa (vermelho se atrasada).
  function chip(t: TaskWithRelations) {
    if (t.color) return { color: t.color };
    const color = byKey[t.status]?.color ?? "#7c8e98";
    const late = isOverdue(t.due_date, t.completed_at);
    return { color: late ? "#c23b3b" : color };
  }

  return (
    <div>
      <PageHeader
        title="Calendário"
        description="Prazos, gravações e publicações do Marketing."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={goToday}>
              Hoje
            </Button>
            <Button size="icon" variant="secondary" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-36 text-center font-display text-sm font-bold capitalize text-white">
              {format(month, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button size="icon" variant="secondary" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Prazos no mês" value={stats.inMonth} color="#375367" index={0} />
        <StatCard icon={CalendarClock} label="Vencem hoje" value={stats.today} color="#e0a900" index={1} />
        <StatCard icon={AlertTriangle} label="Atrasadas no mês" value={stats.overdue} color="#c23b3b" index={2} />
        <StatCard icon={CheckCircle2} label="Concluídas no mês" value={stats.doneInMonth} color="#2f8f5b" index={3} />
      </div>

      {/* Filtros */}
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-3 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Buscar tarefa..."
            aria-label="Buscar tarefa"
            className="h-9 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm text-blue-900 outline-none focus:border-blue-900 sm:max-w-xs"
          />
          <button
            type="button"
            disabled={!profile}
            onClick={() => profile && setFilters({ ...filters, assignees: mine ? [] : [profile.id] })}
            aria-pressed={mine}
            className={cn(
              "h-9 rounded-xl border px-3 text-xs font-bold transition-all active:scale-95 disabled:opacity-50",
              mine ? "border-transparent bg-blue-900 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-050"
            )}
          >
            Minhas
          </button>
          <button
            type="button"
            onClick={() => setFilters({ ...filters, onlyOverdue: !filters.onlyOverdue })}
            aria-pressed={filters.onlyOverdue}
            className={cn(
              "h-9 rounded-xl border px-3 text-xs font-bold transition-all active:scale-95",
              filters.onlyOverdue ? "border-transparent bg-[color:var(--color-danger)] text-white" : "border-gray-200 text-gray-700 hover:bg-gray-050"
            )}
          >
            Atrasadas
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-bold text-blue-900 hover:bg-gray-050"
          >
            <ListFilter className="h-4 w-4" />
            Filtros
            {activeCount > 0 && <span className="rounded-full bg-yellow-500 px-1.5 text-[10px] text-blue-900">{activeCount}</span>}
          </button>
          {activeCount > 0 && (
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-gray-500 hover:bg-gray-100">
              <X className="h-3.5 w-3.5" /> Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-4 border-t border-gray-100 pt-3 md:grid-cols-2">
            <FilterGroup title="Responsável">
              {profiles.map((p) => (
                <FilterChip key={p.id} label={p.full_name} selected={filters.assignees.includes(p.id)} onClick={() => setFilters({ ...filters, assignees: toggleIn(filters.assignees, p.id) })} />
              ))}
            </FilterGroup>
            <FilterGroup title="Etapa">
              {statuses.filter((s) => s.is_active).map((s) => (
                <FilterChip key={s.key} label={s.label} color={s.color} selected={filters.statuses.includes(s.key)} onClick={() => setFilters({ ...filters, statuses: toggleIn(filters.statuses, s.key) })} />
              ))}
            </FilterGroup>
            <FilterGroup title="Prioridade">
              {PRIORITIES.map((p) => (
                <FilterChip key={p.value} label={p.label} color={p.color} selected={filters.priorities.includes(p.value)} onClick={() => setFilters({ ...filters, priorities: toggleIn(filters.priorities, p.value) })} />
              ))}
            </FilterGroup>
            <FilterGroup title="Cor da tarefa">
              {TASK_COLORS.map((c) => (
                <FilterChip key={c.value} label={c.label} color={c.value} selected={filters.colors.includes(c.value)} onClick={() => setFilters({ ...filters, colors: toggleIn(filters.colors, c.value) })} />
              ))}
              <FilterChip label="Sem cor" selected={filters.colors.includes(NO_COLOR)} onClick={() => setFilters({ ...filters, colors: toggleIn(filters.colors, NO_COLOR) })} />
            </FilterGroup>
            {areas.length > 0 && (
              <FilterGroup title="Área">
                {areas.map((a) => (
                  <FilterChip key={a.id} label={a.name} color={a.color} selected={filters.areas.includes(a.id)} onClick={() => setFilters({ ...filters, areas: toggleIn(filters.areas, a.id) })} />
                ))}
              </FilterGroup>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {/* Grade do mês (≥ sm) */}
          <div
            key={format(month, "yyyy-MM")}
            className={cn("ast-fade-up hidden grid-cols-7 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 shadow-[var(--shadow-sm)] sm:grid", loading && "opacity-60")}
          >
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={cn("py-2.5 text-center text-xs font-bold uppercase tracking-wide text-white", i === 0 || i === 6 ? "bg-blue-800" : "bg-blue-900")}>
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayTasks = tasksOn(day);
              const inMonth = isSameMonth(day, month);
              const isSel = isSameDay(day, selected);
              const weekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={day.toISOString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(day)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(day);
                    }
                  }}
                  aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}: ${dayTasks.length} tarefa(s)`}
                  aria-pressed={isSel}
                  className={cn(
                    "group min-h-[112px] cursor-pointer p-1.5 text-left outline-none transition-colors",
                    weekend ? "bg-gray-050" : "bg-white",
                    !inMonth && "bg-gray-100/70 opacity-60",
                    isSel ? "ring-2 ring-inset ring-yellow-500" : "hover:bg-yellow-050/70",
                    "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-900"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-transform group-hover:scale-110",
                        isToday(day) ? "pg-pulse-soft bg-yellow-500 text-blue-900" : "text-gray-500"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="rounded-full bg-blue-050 px-1.5 text-[10px] font-bold text-blue-700">{dayTasks.length}</span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayTasks.slice(0, 3).map((t) => {
                      const { color } = chip(t);
                      return (
                        <Link
                          key={t.id}
                          href={`/tasks/${t.id}`}
                          onClick={(e) => e.stopPropagation()}
                          title={t.title}
                          className="block truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] font-semibold text-blue-900 transition-all hover:translate-x-0.5 hover:brightness-95"
                          style={{ backgroundColor: `${color}1f`, borderLeftColor: color }}
                        >
                          {t.title}
                        </Link>
                      );
                    })}
                    {dayTasks.length > 3 && <p className="px-1 text-[10px] font-bold text-gray-400">+{dayTasks.length - 3} mais</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lista do mês (celular) */}
          <div className="space-y-3 sm:hidden">
            {days.filter((d) => isSameMonth(d, month) && tasksOn(d).length > 0).length === 0 && (
              <p className="py-10 text-center text-sm text-gray-400">Nenhum prazo neste mês.</p>
            )}
            {days
              .filter((day) => isSameMonth(day, month))
              .map((day) => {
                const dayTasks = tasksOn(day);
                if (dayTasks.length === 0) return null;
                return (
                  <div key={day.toISOString()} className="kb-card-in rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          isToday(day) ? "bg-yellow-500 text-blue-900" : "bg-gray-050 text-gray-500"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      <span className="text-sm font-semibold capitalize text-blue-900">{format(day, "EEEE", { locale: ptBR })}</span>
                    </div>
                    <div className="space-y-1.5">
                      {dayTasks.map((t) => {
                        const { color } = chip(t);
                        return (
                          <div key={t.id} className="rounded-md border-l-[3px] px-2 py-1.5" style={{ backgroundColor: `${color}1f`, borderLeftColor: color }}>
                            <div className="flex items-center gap-2">
                              <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 text-xs font-semibold text-blue-900">
                                {t.title}
                              </Link>
                              <button
                                type="button"
                                aria-label="Mudar cor da tarefa"
                                onClick={() => setColorOpenId(colorOpenId === t.id ? null : t.id)}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white"
                              >
                                <Palette className="h-3 w-3 text-gray-500" />
                              </button>
                            </div>
                            {colorOpenId === t.id && (
                              <div className="mt-2">
                                <TaskColorPicker size="sm" value={t.color} onChange={(c) => void changeColor(t.id, c)} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Painel do dia selecionado (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-3 bg-blue-900 px-4 py-3.5 text-white">
              <span className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-yellow-500 leading-none text-blue-900">
                <span className="font-display text-lg font-bold">{format(selected, "d")}</span>
                <span className="text-[9px] font-bold uppercase">{format(selected, "MMM", { locale: ptBR })}</span>
              </span>
              <div className="min-w-0 leading-tight">
                <p className="font-display text-sm font-bold capitalize">{format(selected, "EEEE", { locale: ptBR })}</p>
                <p className="text-xs text-blue-100">
                  {isToday(selected) ? "Hoje · " : ""}
                  {selectedTasks.length} {selectedTasks.length === 1 ? "prazo" : "prazos"}
                </p>
              </div>
              <CalendarCheck className="ml-auto h-5 w-5 text-yellow-500" />
            </div>
            <div key={format(selected, "yyyy-MM-dd")} className="max-h-[calc(100dvh-420px)] min-h-[160px] space-y-2 overflow-y-auto p-3">
              {selectedTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-xs font-semibold text-gray-400">
                  <Inbox className="h-7 w-7 opacity-60" />
                  Nenhum prazo neste dia
                </div>
              ) : (
                selectedTasks.map((t, i) => {
                  const { color } = chip(t);
                  return (
                    <div
                      key={t.id}
                      style={{ animationDelay: `${i * 40}ms`, borderLeftColor: color, backgroundColor: t.color ? `${t.color}14` : undefined }}
                      className="kb-card-in rounded-xl border border-l-4 border-gray-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                    >
                      <div className="flex items-start gap-2">
                        <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 text-sm font-semibold leading-snug text-blue-900">
                          {t.title}
                        </Link>
                        <button
                          type="button"
                          title="Mudar cor"
                          aria-label="Mudar cor da tarefa"
                          onClick={() => setColorOpenId(colorOpenId === t.id ? null : t.id)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white transition-transform hover:scale-110"
                          style={t.color ? { backgroundColor: t.color, borderColor: t.color } : undefined}
                        >
                          <Palette className={cn("h-3 w-3", t.color ? "text-white" : "text-gray-400")} />
                        </button>
                      </div>
                      {colorOpenId === t.id && (
                        <div className="mt-2">
                          <TaskColorPicker size="sm" value={t.color} onChange={(c) => void changeColor(t.id, c)} />
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={t.status} />
                        <PriorityBadge priority={t.priority} />
                        {t.assignees && t.assignees.length > 0 && (
                          <span className="ml-auto flex -space-x-1.5">
                            {t.assignees.slice(0, 3).map((a) => (
                              <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" className="ring-2 ring-white" />
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
