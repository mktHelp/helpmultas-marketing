"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { PriorityBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { listTasks } from "@/lib/services/tasks";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { useTaskStatuses } from "@/lib/task-status-context";
import { cn, isOverdue } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CalendarPage() {
  const supabase = createClient();
  const { byKey } = useTaskStatuses();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    listTasks(supabase, {})
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["tasks", "task_assignees"], load);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  // Agrupa as tarefas por dia uma única vez (evita refiltrar a lista inteira em cada célula).
  const byDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = format(parseISO(t.due_date), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [tasks]);

  const tasksOn = useCallback((day: Date) => byDay.get(format(day, "yyyy-MM-dd")) ?? [], [byDay]);

  const stats = useMemo(() => {
    let inMonth = 0;
    let overdue = 0;
    let doneInMonth = 0;
    let today = 0;
    for (const t of tasks) {
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
  }, [tasks, byKey, month]);

  function goToday() {
    const now = new Date();
    setMonth(now);
    setSelected(now);
  }

  const selectedTasks = tasksOn(selected);

  function chip(t: TaskWithRelations) {
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
                          <Link
                            key={t.id}
                            href={`/tasks/${t.id}`}
                            className="block rounded-md border-l-[3px] px-2 py-1.5 text-xs font-semibold text-blue-900"
                            style={{ backgroundColor: `${color}1f`, borderLeftColor: color }}
                          >
                            {t.title}
                          </Link>
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
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-900 to-blue-800 px-4 py-3.5 text-white">
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
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      style={{ animationDelay: `${i * 40}ms`, borderLeftColor: color }}
                      className="kb-card-in block rounded-xl border border-l-4 border-gray-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                    >
                      <p className="text-sm font-semibold leading-snug text-blue-900">{t.title}</p>
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
                    </Link>
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
