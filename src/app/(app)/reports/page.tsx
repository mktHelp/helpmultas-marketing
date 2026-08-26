"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { AreaDonutChart, ProductivityLineChart, StatusBarChart } from "@/components/dashboard/DashboardCharts";
import { TeamRanking } from "@/components/dashboard/TeamRanking";
import { createClient } from "@/lib/supabase/client";
import { listTasks } from "@/lib/services/tasks";
import { listAreas } from "@/lib/services/reference";
import { listProfiles } from "@/lib/services/profiles";
import { byArea, byStatus, filterByPeriod, productivityByDay, teamRanking } from "@/lib/stats";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/utils";
import { useTaskStatuses } from "@/lib/task-status-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import type { Area, Profile, TaskWithRelations } from "@/types/database";

export default function ReportsPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [days, setDays] = useState(30);
  const { statuses } = useTaskStatuses();

  const load = useCallback(() => {
    listTasks(supabase, { includeArchived: true }).then(setTasks);
    listAreas(supabase).then(setAreas);
    listProfiles(supabase).then(setProfiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["tasks", "task_assignees"], load);

  const periodTasks = filterByPeriod(tasks, days);
  const ranking = teamRanking(periodTasks, profiles, statuses);

  function exportCsv() {
    downloadCsv(
      `relatorio-tarefas-${new Date().toISOString().slice(0, 10)}.csv`,
      tasks.map((t) => ({
        titulo: t.title,
        area: t.area?.name || "",
        responsaveis: t.assignees?.map((a) => a.full_name).join(", ") || "",
        status: t.status,
        prioridade: t.priority,
        prazo: t.due_date ? formatDate(t.due_date) : "",
        criado_em: formatDate(t.created_at),
        concluido_em: t.completed_at ? formatDate(t.completed_at) : "",
      }))
    );
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Análises de produtividade e entregas do Marketing."
        action={
          <div className="flex items-center gap-2">
            <Select className="w-40" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={365}>Último ano</option>
            </Select>
            <Button variant="secondary" onClick={exportCsv} className="gap-1.5">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Distribuição por área">
          <AreaDonutChart data={byArea(periodTasks, areas)} />
        </ChartCard>
        <ChartCard title="Tarefas por status">
          <StatusBarChart data={byStatus(periodTasks, statuses)} />
        </ChartCard>
        <ChartCard title="Volume de produção" className="lg:col-span-2">
          <ProductivityLineChart data={productivityByDay(periodTasks, days > 60 ? 60 : days)} />
        </ChartCard>
      </div>

      <ChartCard title="Produtividade por responsável" className="mt-6">
        <TeamRanking ranking={ranking} />
      </ChartCard>
    </div>
  );
}
