import { differenceInDays, format, isAfter, isBefore, isToday, parseISO, subDays } from "date-fns";
import type { Area, Profile, TaskWithRelations } from "@/types/database";

export function filterByPeriod(tasks: TaskWithRelations[], days: number) {
  const cutoff = subDays(new Date(), days);
  return tasks.filter((t) => isAfter(parseISO(t.created_at), cutoff));
}

export function computeKpis(tasks: TaskWithRelations[]) {
  const open = tasks.filter((t) => t.status !== "concluido" && t.status !== "cancelado").length;
  const completed = tasks.filter((t) => t.status === "concluido").length;
  const overdue = tasks.filter(
    (t) => t.due_date && !t.completed_at && isBefore(parseISO(t.due_date), new Date())
  ).length;
  const dueToday = tasks.filter((t) => t.due_date && isToday(parseISO(t.due_date)) && !t.completed_at).length;
  const inProduction = tasks.filter((t) => t.status === "em_producao").length;
  const total = tasks.length || 1;
  const completionRate = Math.round((completed / total) * 100);

  return { open, completed, overdue, dueToday, inProduction, completionRate, total: tasks.length };
}

export function byArea(tasks: TaskWithRelations[], areas: Area[]) {
  const total = tasks.length || 1;
  return areas
    .map((a) => {
      const count = tasks.filter((t) => t.area_id === a.id).length;
      return { name: a.name, color: a.color, count, percent: Math.round((count / total) * 100) };
    })
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count);
}

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  planejamento: "Planejamento",
  em_producao: "Em Produção",
  em_revisao: "Em Revisão",
  aprovado: "Aprovado",
  publicado: "Publicado",
  concluido: "Concluído",
  pausado: "Pausado",
  cancelado: "Cancelado",
};

export function byStatus(tasks: TaskWithRelations[]) {
  const order = Object.keys(STATUS_LABELS);
  return order
    .map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: tasks.filter((t) => t.status === status).length,
    }))
    .filter((s) => s.count > 0);
}

export function productivityByDay(tasks: TaskWithRelations[], days: number) {
  const result: { date: string; label: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(new Date(), i);
    const dateStr = format(day, "yyyy-MM-dd");
    const count = tasks.filter(
      (t) => t.completed_at && format(parseISO(t.completed_at), "yyyy-MM-dd") === dateStr
    ).length;
    result.push({ date: dateStr, label: format(day, "dd/MM"), count });
  }
  return result;
}

export function teamRanking(tasks: TaskWithRelations[], profiles: Profile[]) {
  return profiles
    .map((p) => {
      const own = tasks.filter((t) => t.assigned_to === p.id);
      const completed = own.filter((t) => t.status === "concluido");
      const overdue = own.filter(
        (t) => t.due_date && !t.completed_at && isBefore(parseISO(t.due_date), new Date())
      );
      const avgDays =
        completed.length > 0
          ? Math.round(
              completed.reduce((sum, t) => sum + differenceInDays(parseISO(t.completed_at!), parseISO(t.created_at)), 0) /
                completed.length
            )
          : 0;
      return {
        profile: p,
        total: own.length,
        completed: completed.length,
        overdue: overdue.length,
        completionRate: own.length ? Math.round((completed.length / own.length) * 100) : 0,
        avgDays,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.completed - a.completed);
}

export function bottlenecks(tasks: TaskWithRelations[]) {
  const now = new Date();
  const overdue = tasks.filter(
    (t) => t.due_date && !t.completed_at && isBefore(parseISO(t.due_date), now) && t.status !== "cancelado"
  );
  const unassigned = tasks.filter((t) => !t.assigned_to && t.status !== "concluido" && t.status !== "cancelado");
  const stuck = tasks.filter(
    (t) =>
      t.status !== "concluido" &&
      t.status !== "cancelado" &&
      differenceInDays(now, parseISO(t.updated_at)) >= 5
  );
  const awaitingApproval = tasks.filter((t) => t.status === "em_revisao" || t.status === "aprovado");
  const dueSoon = tasks.filter(
    (t) =>
      t.due_date &&
      !t.completed_at &&
      differenceInDays(parseISO(t.due_date), now) <= 2 &&
      differenceInDays(parseISO(t.due_date), now) >= 0
  );

  return { overdue, unassigned, stuck, awaitingApproval, dueSoon };
}
