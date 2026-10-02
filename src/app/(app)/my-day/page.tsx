"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format, isAfter, isBefore, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowRight, CalendarCheck, CalendarClock, Check, CheckCircle2, Plus, Sparkles, Sun, Target,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { StatCard } from "@/components/shared/StatCard";
import { TodayAnniversaries } from "@/components/shared/TodayAnniversaries";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/Button";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { PRIORITY_OPTIONS } from "@/components/tasks/TaskFormParts";
import { createClient } from "@/lib/supabase/client";
import { listTasks, updateTask } from "@/lib/services/tasks";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { useTaskStatuses } from "@/lib/task-status-context";
import { cn, formatDate } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

type SectionKey = "overdue" | "today" | "upcoming" | "done";

const SECTIONS: Record<SectionKey, { label: string; color: string; icon: typeof Sun; empty: { title: string; text: string } }> = {
  overdue: { label: "Atrasadas", color: "#c23b3b", icon: AlertTriangle, empty: { title: "Nenhuma tarefa atrasada", text: "Tudo em dia por aqui. 👏" } },
  today: { label: "Hoje", color: "#e0a900", icon: Sun, empty: { title: "Nada para hoje", text: "Aproveite para adiantar tarefas futuras." } },
  upcoming: { label: "Próximas", color: "#3b82f6", icon: CalendarClock, empty: { title: "Sem tarefas futuras", text: "Nenhum prazo à frente por enquanto." } },
  done: { label: "Concluídas hoje", color: "#2f8f5b", icon: CheckCircle2, empty: { title: "Nenhuma conclusão ainda", text: "Marque uma tarefa como feita e ela aparece aqui." } },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function dueLabel(due: string | null) {
  if (!due) return "Sem prazo";
  const diff = differenceInCalendarDays(parseISO(due), new Date());
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  if (diff < 0) return `Há ${-diff} dias`;
  if (diff <= 7) return `Em ${diff} dias`;
  return formatDate(due);
}

/** Anel de progresso do dia. */
function ProgressRing({ percent, size = 84 }: { percent: number; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${percent}% do dia concluído`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#fcbf00"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * percent) / 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display text-xl font-bold tabular-nums">{percent}%</span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-100">do dia</span>
      </span>
    </div>
  );
}

function DayTask({
  task,
  index,
  onComplete,
  canComplete,
  busy,
}: {
  task: TaskWithRelations;
  index: number;
  onComplete?: (t: TaskWithRelations) => void;
  canComplete: boolean;
  busy: boolean;
}) {
  const priority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const overdue = !!task.due_date && !task.completed_at && isBefore(parseISO(task.due_date), new Date());
  const done = !!task.completed_at;
  return (
    <li
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms`, borderLeftColor: priority?.color }}
      className={cn(
        "kb-card-in group flex items-center gap-3 rounded-2xl border border-l-4 border-gray-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
        busy && "pointer-events-none opacity-50"
      )}
    >
      {canComplete && onComplete && !done ? (
        <button
          type="button"
          onClick={() => onComplete(task)}
          aria-label={`Concluir tarefa ${task.title}`}
          title="Marcar como concluída"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-transparent transition-all hover:border-[color:var(--color-success)] hover:bg-[color:var(--color-success-bg)] hover:text-[color:var(--color-success)] active:scale-90"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </button>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-success)] text-white">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      )}

      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-bold text-blue-900", done && "text-gray-500 line-through decoration-gray-300")}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-gray-500">
          {task.area && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.area.color || "#4a6a80" }} />
              {task.area.name}
            </span>
          )}
          {task.due_date && !done && (
            <span className={cn("inline-flex items-center gap-1 font-semibold", overdue && "text-[color:var(--color-danger)]")}>
              {overdue ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
              {dueLabel(task.due_date)}
            </span>
          )}
          {done && task.completed_at && <span className="font-semibold text-[color:var(--color-success)]">Concluída às {format(parseISO(task.completed_at), "HH:mm")}</span>}
        </p>
      </Link>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {priority && (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: `${priority.color}1a`, color: priority.color }}>
            {priority.label}
          </span>
        )}
        <StatusBadge status={task.status} />
      </div>
      {task.assignees && task.assignees.length > 0 && (
        <div className="flex shrink-0 -space-x-1.5">
          {task.assignees.slice(0, 3).map((a) => (
            <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="sm" className="ring-2 ring-white" />
          ))}
        </div>
      )}
    </li>
  );
}

export default function MyDayPage() {
  const { profile } = useAuth();
  const { statuses } = useTaskStatuses();
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<SectionKey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const doneKey = statuses.find((s) => s.is_done)?.key ?? null;

  const load = useCallback(() => {
    if (!profile) return;
    listTasks(supabase, { assignedTo: [profile.id] })
      .then(setTasks)
      .catch(() => toast.error("Não foi possível carregar suas tarefas"))
      .finally(() => setLoading(false));
  }, [profile, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeChanges(["tasks", "task_assignees"], load);

  const groups = useMemo(() => {
    const now = new Date();
    const open = tasks.filter((t) => !t.completed_at);
    const byDue = (a: TaskWithRelations, b: TaskWithRelations) => (a.due_date ?? "").localeCompare(b.due_date ?? "");
    return {
      overdue: open.filter((t) => t.due_date && isBefore(parseISO(t.due_date), now) && !isToday(parseISO(t.due_date))).sort(byDue),
      today: open.filter((t) => t.due_date && isToday(parseISO(t.due_date))).sort(byDue),
      upcoming: open.filter((t) => t.due_date && isAfter(parseISO(t.due_date), now) && !isToday(parseISO(t.due_date))).sort(byDue),
      done: tasks.filter((t) => t.completed_at && isToday(parseISO(t.completed_at))),
    } satisfies Record<SectionKey, TaskWithRelations[]>;
  }, [tasks]);

  // Seção aberta por padrão: a mais urgente que tiver algo.
  const active: SectionKey = picked ?? (groups.overdue.length ? "overdue" : groups.today.length ? "today" : groups.upcoming.length ? "upcoming" : "done");
  const list = groups[active];
  const meta = SECTIONS[active];

  const planned = groups.overdue.length + groups.today.length + groups.done.length;
  const percent = planned === 0 ? 100 : Math.round((groups.done.length / planned) * 100);
  const focus = groups.overdue[0] ?? groups.today[0] ?? groups.upcoming[0] ?? null;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  async function complete(task: TaskWithRelations) {
    if (!doneKey) return;
    const previous = task.status;
    setBusyId(task.id);
    try {
      await updateTask(supabase, task.id, { status: doneKey });
      toast.success("Tarefa concluída! 🎉", {
        action: {
          label: "Desfazer",
          onClick: () => {
            updateTask(supabase, task.id, { status: previous }).then(load).catch(() => toast.error("Não foi possível desfazer"));
          },
        },
      });
      load();
    } catch {
      toast.error("Não foi possível concluir a tarefa");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHero
        tone="day"
        icon={Sun}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}!`}
        description={format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        aside={<ProgressRing percent={percent} />}
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova tarefa</span>
          </Button>
        }
      >
        <span className="rounded-full bg-white/10 px-2.5 py-1">
          {groups.today.length} {groups.today.length === 1 ? "tarefa para hoje" : "tarefas para hoje"}
        </span>
        {groups.overdue.length > 0 && <span className="rounded-full bg-red-500/90 px-2.5 py-1">{groups.overdue.length} atrasada{groups.overdue.length === 1 ? "" : "s"}</span>}
        <span className="rounded-full bg-white/10 px-2.5 py-1">{groups.done.length} concluída{groups.done.length === 1 ? "" : "s"} hoje</span>
        {focus && (
          <Link
            href={`/tasks/${focus.id}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-yellow-500 px-3 py-1 font-bold text-blue-900 transition-all hover:bg-yellow-400 active:scale-95"
          >
            <Target className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Foco: {focus.title}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        )}
      </PageHero>

      <TodayAnniversaries onlyMine />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(Object.keys(SECTIONS) as SectionKey[]).map((key, i) => (
          <StatCard
            key={key}
            icon={SECTIONS[key].icon}
            label={SECTIONS[key].label}
            value={groups[key].length}
            color={SECTIONS[key].color}
            index={i}
            active={active === key}
            onClick={() => setPicked(key)}
          />
        ))}
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-3 shadow-[var(--shadow-sm)] sm:p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}>
            <meta.icon className="h-[18px] w-[18px]" />
          </span>
          <h2 className="font-display text-base font-bold text-blue-900">
            {meta.label} <span className="text-gray-400">({list.length})</span>
          </h2>
          <Link href="/my-tasks" className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-blue-800 transition-colors hover:bg-blue-050">
            Todas as minhas tarefas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2" role="status" aria-label="Carregando tarefas">
            {[0, 1, 2].map((i) => (
              <div key={i} className="ast-skeleton h-16 rounded-2xl" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div key={active} className="ast-fade-up flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-gray-050/60 px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}>
              {active === "done" ? <Sparkles className="h-6 w-6" /> : <CalendarCheck className="h-6 w-6" />}
            </span>
            <p className="font-display text-base font-bold text-blue-900">{meta.empty.title}</p>
            <p className="text-sm text-gray-500">{meta.empty.text}</p>
          </div>
        ) : (
          <ul key={active} className="space-y-2">
            {list.slice(0, active === "upcoming" ? 12 : 50).map((t, i) => (
              <DayTask key={t.id} task={t} index={i} onComplete={complete} canComplete={!!doneKey && active !== "done"} busy={busyId === t.id} />
            ))}
          </ul>
        )}
      </section>

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
