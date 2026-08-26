import { differenceInDays, format, isAfter, isBefore, isToday, parseISO, subDays } from "date-fns";
import type { Area, Profile, TaskStatusRow, TaskWithRelations } from "@/types/database";

function statusFlags(statuses: TaskStatusRow[]) {
  const doneKeys = new Set(statuses.filter((s) => s.is_done).map((s) => s.key));
  const cancelledKeys = new Set(statuses.filter((s) => s.is_cancelled).map((s) => s.key));
  return { doneKeys, cancelledKeys };
}

export function filterByPeriod(tasks: TaskWithRelations[], days: number) {
  const cutoff = subDays(new Date(), days);
  return tasks.filter((t) => isAfter(parseISO(t.created_at), cutoff));
}

export function computeKpis(tasks: TaskWithRelations[], statuses: TaskStatusRow[]) {
  const { doneKeys, cancelledKeys } = statusFlags(statuses);
  const open = tasks.filter((t) => !doneKeys.has(t.status) && !cancelledKeys.has(t.status)).length;
  const completed = tasks.filter((t) => doneKeys.has(t.status)).length;
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

export function byStatus(tasks: TaskWithRelations[], statuses: TaskStatusRow[]) {
  return statuses
    .map((s) => ({
      status: s.key,
      label: s.label,
      color: s.color,
      count: tasks.filter((t) => t.status === s.key).length,
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

export function teamRanking(tasks: TaskWithRelations[], profiles: Profile[], statuses: TaskStatusRow[]) {
  const { doneKeys } = statusFlags(statuses);
  return profiles
    .map((p) => {
      const own = tasks.filter((t) => t.assignees?.some((a) => a.id === p.id));
      const completed = own.filter((t) => doneKeys.has(t.status));
      const overdue = own.filter(
        (t) => t.due_date && !t.completed_at && isBefore(parseISO(t.due_date), new Date())
      );
      // Some "done" tasks may not have completed_at set (e.g. created directly
      // in a done stage, before a stage was marked done, etc.) - exclude those
      // from the average instead of crashing on parseISO(null).
      const withCompletionDate = completed.filter((t) => t.completed_at);
      const avgDays =
        withCompletionDate.length > 0
          ? Math.round(
              withCompletionDate.reduce(
                (sum, t) => sum + differenceInDays(parseISO(t.completed_at!), parseISO(t.created_at)),
                0
              ) / withCompletionDate.length
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

export function bottlenecks(tasks: TaskWithRelations[], statuses: TaskStatusRow[]) {
  const { doneKeys, cancelledKeys } = statusFlags(statuses);
  const now = new Date();
  const overdue = tasks.filter(
    (t) => t.due_date && !t.completed_at && isBefore(parseISO(t.due_date), now) && !cancelledKeys.has(t.status)
  );
  const unassigned = tasks.filter(
    (t) => !(t.assignees && t.assignees.length) && !doneKeys.has(t.status) && !cancelledKeys.has(t.status)
  );
  const stuck = tasks.filter(
    (t) => !doneKeys.has(t.status) && !cancelledKeys.has(t.status) && differenceInDays(now, parseISO(t.updated_at)) >= 5
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
