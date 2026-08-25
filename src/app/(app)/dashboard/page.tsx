import { ListTodo, CheckCircle2, AlertTriangle, CalendarClock, Video, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { listTasks } from "@/lib/services/tasks";
import { listAreas, listTaskStatuses } from "@/lib/services/reference";
import { listProfiles } from "@/lib/services/profiles";
import { computeKpis, byArea, byStatus, productivityByDay, teamRanking, bottlenecks } from "@/lib/stats";
import { StatCard } from "@/components/dashboard/StatCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { AreaDonutChart, StatusBarChart, ProductivityLineChart } from "@/components/dashboard/DashboardCharts";
import { TeamRanking } from "@/components/dashboard/TeamRanking";
import { TaskListItem } from "@/components/tasks/TaskListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();

  const [tasks, areas, profiles, statuses] = await Promise.all([
    listTasks(supabase, {}),
    listAreas(supabase),
    listProfiles(supabase),
    listTaskStatuses(supabase),
  ]);

  const kpis = computeKpis(tasks, statuses);
  const areaData = byArea(tasks, areas);
  const statusData = byStatus(tasks, statuses);
  const productivity = productivityByDay(tasks, 14);
  const ranking = teamRanking(tasks, profiles, statuses);
  const problems = bottlenecks(tasks, statuses);

  const doneOrCancelled = new Set(statuses.filter((s) => s.is_done || s.is_cancelled).map((s) => s.key));
  const priorityTasks = tasks
    .filter((t) => !doneOrCancelled.has(t.status) && !t.is_archived)
    .sort((a, b) => {
      const order = { urgente: 0, alta: 1, media: 2, baixa: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-blue-900">
          {greeting()}, {profile?.full_name?.split(" ")[0] || "time"} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">Veja o que está acontecendo no Marketing hoje.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={ListTodo} label="Tarefas abertas" value={kpis.open} tone="neutral" />
        <StatCard icon={CheckCircle2} label="Concluídas" value={kpis.completed} tone="success" />
        <StatCard icon={AlertTriangle} label="Em atraso" value={kpis.overdue} tone="danger" />
        <StatCard icon={CalendarClock} label="Para hoje" value={kpis.dueToday} tone="accent" />
        <StatCard icon={Video} label="Em produção" value={kpis.inProduction} tone="neutral" />
        <StatCard icon={Percent} label="Taxa de conclusão" value={`${kpis.completionRate}%`} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Distribuição por área" className="lg:col-span-1">
          <AreaDonutChart data={areaData} />
          <div className="mt-2 space-y-1.5">
            {areaData.slice(0, 5).map((a) => (
              <div key={a.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                  {a.name}
                </span>
                <span className="font-semibold text-blue-900">{a.count} ({a.percent}%)</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Tarefas por status" className="lg:col-span-1">
          <StatusBarChart data={statusData} />
        </ChartCard>

        <ChartCard title="Produtividade (14 dias)" className="lg:col-span-1">
          <ProductivityLineChart data={productivity} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Tarefas prioritárias" className="lg:col-span-2">
          {priorityTasks.length === 0 ? (
            <EmptyState title="Você está em dia!" description="Nenhuma tarefa prioritária pendente." />
          ) : (
            <div className="space-y-2">
              {priorityTasks.map((t) => <TaskListItem key={t.id} task={t} />)}
            </div>
          )}
        </ChartCard>

        <Card className="p-5">
          <h3 className="font-display text-[17px] font-semibold text-blue-900">Gargalos</h3>
          <div className="mt-3 space-y-2.5 text-sm">
            <BottleneckRow label="Atrasadas" count={problems.overdue.length} />
            <BottleneckRow label="Sem responsável" count={problems.unassigned.length} />
            <BottleneckRow label="Paradas há +5 dias" count={problems.stuck.length} />
            <BottleneckRow label="Aguardando aprovação" count={problems.awaitingApproval.length} />
            <BottleneckRow label="Vencendo em 48h" count={problems.dueSoon.length} />
          </div>
        </Card>
      </div>

      <ChartCard title="Ranking da equipe">
        <TeamRanking ranking={ranking} />
      </ChartCard>
    </div>
  );
}

function BottleneckRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-100/60 px-3 py-2">
      <span className="text-gray-700">{label}</span>
      <span className={count > 0 ? "font-bold text-[color:var(--color-danger)]" : "font-bold text-gray-400"}>
        {count}
      </span>
    </div>
  );
}
