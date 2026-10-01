"use client";

import { useMemo, useState } from "react";
import { AtSign, Download, FileText, LayoutGrid, ListTodo, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { ReportsOverview, summaryRows } from "@/components/reports/ReportsOverview";
import { ReportsTasks } from "@/components/reports/ReportsTasks";
import { ReportsInstagram } from "@/components/reports/ReportsInstagram";
import { ReportsTraffic } from "@/components/reports/ReportsTraffic";
import { buildReport } from "@/lib/reports-data";
import { REPORT_PERIOD_OPTIONS, reportPeriodLabel, reportRange, type ReportPeriodKey } from "@/lib/report-period";
import { shiftDate, todayBRT, type DateRange } from "@/lib/period";
import { downloadCsv } from "@/lib/csv";
import { cpl, ctr } from "@/lib/traffic-analytics";
import type { ReportsRawData } from "@/lib/services/reports";
import { cn } from "@/lib/utils";

// Aba Relatórios: visão geral consolidada (Instagram + Tráfego + Produção) e
// uma aba por frente, todas com o mesmo período e a mesma base de cálculo
// (lib/reports-data). O PDF executivo aceita escolher as seções.

type Section = "overview" | "tasks" | "instagram" | "traffic";

const SECTIONS: { key: Section; label: string; icon: typeof LayoutGrid }[] = [
  { key: "overview", label: "Visão geral", icon: LayoutGrid },
  { key: "tasks", label: "Tarefas", icon: ListTodo },
  { key: "instagram", label: "Instagram", icon: AtSign },
  { key: "traffic", label: "Tráfego pago", icon: Megaphone },
];

function DateField({ label, value, max, onChange }: { label: string; value: string; max?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
      {label}
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-9 rounded-[14px] border border-gray-200 bg-white px-3 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
    </label>
  );
}

export function ReportsHub({ raw }: { raw: ReportsRawData }) {
  const today = useMemo(() => todayBRT(), []);
  const [section, setSection] = useState<Section>("overview");
  const [period, setPeriod] = useState<ReportPeriodKey>("30");
  const [custom, setCustom] = useState<DateRange>(() => ({ from: shiftDate(todayBRT(), -30), to: shiftDate(todayBRT(), -1) }));

  const range = useMemo(() => reportRange(period, custom, today), [period, custom, today]);
  const label = reportPeriodLabel(period, range);
  const model = useMemo(() => buildReport(raw, range, today), [raw, range, today]);

  const stamp = `${range.from}_a_${range.to}`;

  function exportCsv() {
    if (section === "overview") {
      downloadCsv(
        `relatorio-geral-${stamp}.csv`,
        summaryRows(model).map((r) => ({ area: r.group, indicador: r.label, periodo: r.text, anterior: r.prevText }))
      );
    } else if (section === "tasks") {
      const rows = model.tasks.doneList.map((t) => ({
        titulo: t.title,
        area: t.areaName,
        prioridade: t.priority,
        status: t.status,
        criada_em: t.createdDay,
        prazo: t.dueDay ?? "",
        concluida_em: t.completedDay ?? "",
      }));
      downloadCsv(`relatorio-tarefas-${stamp}.csv`, rows);
    } else if (section === "instagram") {
      const rows = raw.instagram.insights
        .filter((r) => r.date >= range.from && r.date <= range.to)
        .map((r) => ({
          data: r.date,
          perfil: raw.instagram.accounts.find((a) => a.id === r.account_id)?.label ?? "",
          visualizacoes: r.views,
          alcance: r.reach,
          interacoes: r.total_interactions,
          curtidas: r.likes,
          comentarios: r.comments,
          compartilhamentos: r.shares,
          salvamentos: r.saves,
          visitas_perfil: r.profile_views,
          cliques_link: r.website_clicks,
          seguidores_liquidos: r.net_followers,
        }));
      downloadCsv(`relatorio-instagram-${stamp}.csv`, rows);
    } else {
      downloadCsv(
        `relatorio-trafego-${stamp}.csv`,
        model.traffic.campaigns.map((c) => ({
          campanha: c.name,
          investido: c.m.spend.toFixed(2),
          impressoes: c.m.impressions,
          cliques: c.m.clicks,
          ctr: ctr(c.m).toFixed(2),
          leads: c.m.leads,
          cpl: c.m.leads ? cpl(c.m).toFixed(2) : "",
        }))
      );
    }
  }

  const pdfSections = section === "overview" ? "instagram,trafego,tarefas" : section === "tasks" ? "tarefas" : section === "instagram" ? "instagram" : "trafego";
  const pdfHref = `/relatorio/geral?period=custom&from=${range.from}&to=${range.to}&sections=${pdfSections}&print=1`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors",
                section === s.key ? "border-blue-900 bg-blue-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-blue-900 hover:text-blue-900"
              )}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <a href={pdfHref} target="_blank" rel="noreferrer">
            <Button size="sm" className="gap-1.5">
              <FileText className="h-4 w-4" /> Baixar PDF
            </Button>
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-full overflow-x-auto">
          <Tabs tabs={REPORT_PERIOD_OPTIONS} active={period} onChange={(k) => setPeriod(k as ReportPeriodKey)} />
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <DateField label="De" value={custom.from} max={today} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
            <DateField label="Até" value={custom.to} max={today} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        <span className="font-semibold text-blue-900">{label}</span>
        {` · ${shiftLabel(range.from)} a ${shiftLabel(range.to)}`}
        {model.closed
          ? ` · comparado a ${shiftLabel(model.prevRange.from)} – ${shiftLabel(model.prevRange.to)}`
          : " · o período inclui hoje (parcial): sem comparação com o período anterior"}
      </p>

      {section === "overview" && <ReportsOverview model={model} label={label} />}
      {section === "tasks" && <ReportsTasks model={model} label={label} />}
      {section === "instagram" && <ReportsInstagram model={model} label={label} period={period} range={range} />}
      {section === "traffic" && <ReportsTraffic model={model} label={label} range={range} />}
    </div>
  );
}

const shiftLabel = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
