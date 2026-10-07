"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Eye, Image as ImageIcon, Layers, Megaphone, MousePointerClick, Percent,
  Target, Wallet, X,
} from "lucide-react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { createClient } from "@/lib/supabase/client";
import {
  aggregateTraffic,
  defaultDateRange,
  loadTrafficStructure,
  type AdRow,
  type AdSetRow,
  type CampaignRow,
  type DateRange,
  type Metrics,
  type TrafficStructure,
} from "@/lib/services/meta-ads";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { currencyFormatter, formatDay, numberFormatter } from "@/lib/format";
import { shiftDate, todayBRT } from "@/lib/period";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/SearchInput";

// Espelha a estrutura do Gerenciador de Anúncios da Meta: uma aba por nível
// (campanha / conjunto de anúncios / anúncios), cada uma com suas próprias
// métricas somadas do período escolhido no seletor de datas. Clicar numa
// campanha "entra" nela — filtra os conjuntos daquela campanha e pula pra
// aba de conjuntos, e o mesmo de conjunto pra anúncios (breadcrumb no topo
// pra voltar/limpar). Clicar num anúncio abre o preview visual (iframe
// oficial da Meta) em vez de continuar a navegação, já que é o nível mais
// baixo. Tudo somente leitura — os dados vêm do job de sync (app/api/meta-ads/sync).

function ctrOf(m: Metrics) {
  return m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
}

function zero(): Metrics {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
}
function addUp(a: Metrics, b: Metrics): Metrics {
  return {
    spend: a.spend + b.spend,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions + b.conversions,
  };
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  CAMPAIGN_PAUSED: "Campanha pausada",
  ADSET_PAUSED: "Conjunto pausado",
  ARCHIVED: "Arquivado",
  DELETED: "Excluído",
  WITH_ISSUES: "Com problemas",
  PENDING_REVIEW: "Em análise",
  IN_PROCESS: "Processando",
  DISAPPROVED: "Reprovado",
};

function StatusPill({ status }: { status: string }) {
  if (!status) return <span className="text-gray-300">—</span>;
  const active = status === "ACTIVE";
  const paused = status.includes("PAUSED");
  const warn = status === "PENDING_REVIEW" || status === "IN_PROCESS";
  const tone = active
    ? "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]"
    : paused || warn
    ? "bg-gray-100 text-gray-600"
    : "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]";
  const dot = active ? "bg-[color:var(--color-success)]" : paused || warn ? "bg-gray-400" : "bg-[color:var(--color-danger)]";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold", tone)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot, active && "animate-pulse")} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function SpendCell({ value, max }: { value: number; max: number }) {
  return (
    <div className="min-w-[96px]">
      <span className="font-semibold tabular-nums text-blue-900">{currencyFormatter.format(value)}</span>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" style={{ width: `${max > 0 ? Math.max(3, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

type Column<T> = {
  key: string;
  label: string;
  widthClass: string;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
};

function SortableTable<T extends { id: string }>({
  rows,
  columns,
  emptyLabel,
  defaultSortKey,
  onRowClick,
  mobileCard,
  loading,
}: {
  rows: T[];
  columns: Column<T>[];
  emptyLabel: string;
  defaultSortKey?: string;
  onRowClick?: (row: T) => void;
  /** cartão usado no celular no lugar da tabela larga */
  mobileCard?: (row: T) => React.ReactNode;
  loading?: boolean;
}) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortKey(null);
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === "string" ? av.localeCompare(String(bv), "pt-BR") : Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, columns]);

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Carregando">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ast-skeleton h-14 rounded-2xl" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <div className="ast-fade-up flex flex-col items-center gap-2 rounded-3xl border border-dashed border-gray-200 bg-gray-050/60 px-6 py-14 text-center">
        <Megaphone className="h-7 w-7 text-gray-300" />
        <p className="text-sm text-gray-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      {mobileCard && (
        <ul className="space-y-2.5 md:hidden">
          {sortedRows.slice(0, 60).map((row, i) => (
            <li
              key={row.id}
              style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn("kb-card-in", onRowClick && "cursor-pointer active:scale-[0.99]")}
            >
              {mobileCard(row)}
            </li>
          ))}
        </ul>
      )}

      <div className={cn("max-h-[70vh] overflow-auto rounded-3xl border border-gray-200 bg-white shadow-[var(--shadow-sm)]", mobileCard && "hidden md:block")}>
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-white">
              {columns.map((col) => (
                <th key={col.key} className={cn("sticky top-0 z-20 bg-blue-900 px-4 py-3", col.widthClass)}>
                  {col.sortValue ? (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className={cn("flex items-center gap-1 uppercase transition-colors hover:text-yellow-400", sortKey === col.key && "text-yellow-400")}
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
                className={cn(
                  "kb-card-in border-b border-gray-100 transition-colors last:border-0",
                  i % 2 === 1 && "bg-gray-050/50",
                  onRowClick && "cursor-pointer hover:bg-yellow-050/70"
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MetricCard({
  title,
  subtitle,
  status,
  metrics,
  chip,
}: {
  title: string;
  subtitle?: string;
  status?: string;
  metrics: Metrics;
  chip?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-blue-900">{title}</p>
          {subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {status !== undefined && <StatusPill status={status} />}
      </div>
      {chip && <span className="mt-2 inline-block rounded-full bg-yellow-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-900">{chip}</span>}
      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-gray-100 pt-3 text-center">
        {[
          ["Investido", currencyFormatter.format(metrics.spend)],
          ["Cliques", numberFormatter.format(metrics.clicks)],
          ["CTR", `${ctrOf(metrics).toFixed(2)}%`],
          ["Conv.", numberFormatter.format(metrics.conversions)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dd className="truncate text-[13px] font-bold tabular-nums text-blue-900">{value}</dd>
            <dt className="text-[10px] font-bold uppercase text-gray-400">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

function useNameFilter<T>(rows: T[], getHaystack: (row: T) => string) {
  const [name, setName] = useState("");
  const filtered = useMemo(
    () => (name ? rows.filter((r) => getHaystack(r).toLowerCase().includes(name.toLowerCase())) : rows),
    [rows, name, getHaystack]
  );
  return { name, setName, filtered };
}

function Toolbar({
  value,
  onChange,
  placeholder,
  summary,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  summary: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchInput value={value} onChange={onChange} placeholder={placeholder} />
      {children}
      <span className="ml-auto text-xs font-semibold text-gray-500">{summary}</span>
    </div>
  );
}

function CampaignsSection({ rows, loading, onSelect }: { rows: CampaignRow[]; loading: boolean; onSelect: (campaign: CampaignRow) => void }) {
  const { name, setName, filtered } = useNameFilter(rows, (r) => r.name);
  const totals = useMemo(() => filtered.reduce((acc, r) => addUp(acc, r.metrics), zero()), [filtered]);
  const maxSpend = useMemo(() => Math.max(0, ...filtered.map((r) => r.metrics.spend)), [filtered]);

  const columns: Column<CampaignRow>[] = [
    { key: "name", label: "Campanha", widthClass: "min-w-72", sortValue: (r) => r.name, render: (r) => <span className="font-semibold text-blue-900">{r.name}</span> },
    { key: "objective", label: "Objetivo", widthClass: "w-40", sortValue: (r) => r.objective, render: (r) => r.objective || "—" },
    { key: "status", label: "Status", widthClass: "w-36", render: (r) => <StatusPill status={r.status} /> },
    { key: "budget", label: "Orçamento diário", widthClass: "w-36", sortValue: (r) => r.daily_budget ?? 0, render: (r) => (r.daily_budget ? currencyFormatter.format(r.daily_budget) : "—") },
    { key: "adsets", label: "Conjuntos", widthClass: "w-24", sortValue: (r) => r.adSetsCount, render: (r) => numberFormatter.format(r.adSetsCount) },
    { key: "ads", label: "Anúncios", widthClass: "w-24", sortValue: (r) => r.adsCount, render: (r) => numberFormatter.format(r.adsCount) },
    { key: "spend", label: "Investido", widthClass: "w-40", sortValue: (r) => r.metrics.spend, render: (r) => <SpendCell value={r.metrics.spend} max={maxSpend} /> },
    { key: "impressions", label: "Impressões", widthClass: "w-32", sortValue: (r) => r.metrics.impressions, render: (r) => numberFormatter.format(r.metrics.impressions) },
    { key: "clicks", label: "Cliques no link", widthClass: "w-28", sortValue: (r) => r.metrics.clicks, render: (r) => numberFormatter.format(r.metrics.clicks) },
    { key: "ctr", label: "CTR", widthClass: "w-24", sortValue: (r) => ctrOf(r.metrics), render: (r) => `${ctrOf(r.metrics).toFixed(2)}%` },
    { key: "conversions", label: "Conversões", widthClass: "w-28", sortValue: (r) => r.metrics.conversions, render: (r) => numberFormatter.format(r.metrics.conversions) },
  ];

  return (
    <div>
      <Toolbar
        value={name}
        onChange={setName}
        placeholder="Buscar campanha…"
        summary={`${filtered.length} ${filtered.length === 1 ? "campanha" : "campanhas"} · ${currencyFormatter.format(totals.spend)} investidos`}
      />
      <SortableTable
        rows={filtered}
        columns={columns}
        defaultSortKey="spend"
        loading={loading}
        emptyLabel="Nenhuma campanha sincronizada ainda."
        onRowClick={onSelect}
        mobileCard={(r) => (
          <MetricCard title={r.name} subtitle={r.objective || undefined} status={r.status} metrics={r.metrics} chip={`${r.adSetsCount} conjuntos · ${r.adsCount} anúncios`} />
        )}
      />
    </div>
  );
}

function AdSetsSection({
  rows,
  loading,
  showCampaign,
  onSelect,
}: {
  rows: AdSetRow[];
  loading: boolean;
  showCampaign: boolean;
  onSelect: (adSet: AdSetRow) => void;
}) {
  const { name, setName, filtered } = useNameFilter(rows, (r) => `${r.name} ${r.campaign?.name ?? ""}`);
  const totals = useMemo(() => filtered.reduce((acc, r) => addUp(acc, r.metrics), zero()), [filtered]);
  const maxSpend = useMemo(() => Math.max(0, ...filtered.map((r) => r.metrics.spend)), [filtered]);

  const columns: Column<AdSetRow>[] = [
    { key: "name", label: "Conjunto de anúncios", widthClass: "min-w-64", sortValue: (r) => r.name, render: (r) => <span className="font-semibold text-blue-900">{r.name}</span> },
    ...(showCampaign
      ? [{ key: "campaign", label: "Campanha", widthClass: "min-w-56", sortValue: (r: AdSetRow) => r.campaign?.name ?? "", render: (r: AdSetRow) => r.campaign?.name ?? "—" }]
      : []),
    { key: "status", label: "Status", widthClass: "w-36", render: (r) => <StatusPill status={r.status} /> },
    { key: "goal", label: "Otimização", widthClass: "w-40", sortValue: (r) => r.optimization_goal, render: (r) => r.optimization_goal || "—" },
    { key: "budget", label: "Orçamento diário", widthClass: "w-36", sortValue: (r) => r.daily_budget ?? 0, render: (r) => (r.daily_budget ? currencyFormatter.format(r.daily_budget) : "—") },
    { key: "ads", label: "Anúncios", widthClass: "w-24", sortValue: (r) => r.adsCount, render: (r) => numberFormatter.format(r.adsCount) },
    { key: "spend", label: "Investido", widthClass: "w-40", sortValue: (r) => r.metrics.spend, render: (r) => <SpendCell value={r.metrics.spend} max={maxSpend} /> },
    { key: "impressions", label: "Impressões", widthClass: "w-32", sortValue: (r) => r.metrics.impressions, render: (r) => numberFormatter.format(r.metrics.impressions) },
    { key: "clicks", label: "Cliques no link", widthClass: "w-28", sortValue: (r) => r.metrics.clicks, render: (r) => numberFormatter.format(r.metrics.clicks) },
    { key: "ctr", label: "CTR", widthClass: "w-24", sortValue: (r) => ctrOf(r.metrics), render: (r) => `${ctrOf(r.metrics).toFixed(2)}%` },
    { key: "conversions", label: "Conversões", widthClass: "w-28", sortValue: (r) => r.metrics.conversions, render: (r) => numberFormatter.format(r.metrics.conversions) },
  ];

  return (
    <div>
      <Toolbar
        value={name}
        onChange={setName}
        placeholder="Buscar conjunto ou campanha…"
        summary={`${filtered.length} ${filtered.length === 1 ? "conjunto" : "conjuntos"} · ${currencyFormatter.format(totals.spend)} investidos`}
      />
      <SortableTable
        rows={filtered}
        columns={columns}
        defaultSortKey="spend"
        loading={loading}
        emptyLabel="Nenhum conjunto de anúncios sincronizado ainda."
        onRowClick={onSelect}
        mobileCard={(r) => (
          <MetricCard title={r.name} subtitle={r.campaign?.name} status={r.status} metrics={r.metrics} chip={`${r.adsCount} anúncios${r.optimization_goal ? ` · ${r.optimization_goal}` : ""}`} />
        )}
      />
    </div>
  );
}

function AdsSection({
  rows,
  loading,
  showCampaign,
  onSelect,
}: {
  rows: AdRow[];
  loading: boolean;
  showCampaign: boolean;
  onSelect: (ad: AdRow) => void;
}) {
  const [matched, setMatched] = useState("");
  const { name, setName, filtered: byName } = useNameFilter(
    rows,
    (r) => `${r.name} ${r.adset?.campaign?.name ?? ""} ${r.adset?.name ?? ""}`
  );
  const filtered = useMemo(() => {
    if (!matched) return byName;
    return byName.filter((r) => (matched === "sim" ? !!r.matched_creative_id : !r.matched_creative_id));
  }, [byName, matched]);
  const totals = useMemo(() => filtered.reduce((acc, r) => addUp(acc, r.metrics), zero()), [filtered]);
  const maxSpend = useMemo(() => Math.max(0, ...filtered.map((r) => r.metrics.spend)), [filtered]);

  const columns: Column<AdRow>[] = [
    { key: "name", label: "Anúncio", widthClass: "min-w-72", sortValue: (r) => r.name, render: (r) => <span className="font-semibold text-blue-900">{r.name}</span> },
    ...(showCampaign
      ? [
          {
            key: "campaign",
            label: "Campanha / Conjunto",
            widthClass: "min-w-64",
            sortValue: (r: AdRow) => r.adset?.campaign?.name ?? "",
            render: (r: AdRow) => (
              <div>
                <div className="text-gray-700">{r.adset?.campaign?.name ?? "—"}</div>
                <div className="text-xs text-gray-400">{r.adset?.name ?? "—"}</div>
              </div>
            ),
          },
        ]
      : []),
    { key: "status", label: "Status", widthClass: "w-36", render: (r) => <StatusPill status={r.effective_status} /> },
    {
      key: "creative",
      label: "Criativo vinculado",
      widthClass: "w-56",
      render: (r) =>
        r.matched_creative ? (
          <span className="inline-block max-w-[200px] truncate rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-bold text-blue-900">{r.matched_creative.name}</span>
        ) : (
          <span className="text-gray-400">Sem vínculo</span>
        ),
    },
    { key: "spend", label: "Investido", widthClass: "w-40", sortValue: (r) => r.metrics.spend, render: (r) => <SpendCell value={r.metrics.spend} max={maxSpend} /> },
    { key: "impressions", label: "Impressões", widthClass: "w-32", sortValue: (r) => r.metrics.impressions, render: (r) => numberFormatter.format(r.metrics.impressions) },
    { key: "clicks", label: "Cliques no link", widthClass: "w-28", sortValue: (r) => r.metrics.clicks, render: (r) => numberFormatter.format(r.metrics.clicks) },
    { key: "ctr", label: "CTR", widthClass: "w-24", sortValue: (r) => ctrOf(r.metrics), render: (r) => `${ctrOf(r.metrics).toFixed(2)}%` },
    { key: "conversions", label: "Conversões", widthClass: "w-28", sortValue: (r) => r.metrics.conversions, render: (r) => numberFormatter.format(r.metrics.conversions) },
  ];

  return (
    <div>
      <Toolbar
        value={name}
        onChange={setName}
        placeholder="Buscar anúncio, campanha ou conjunto…"
        summary={`${filtered.length} ${filtered.length === 1 ? "anúncio" : "anúncios"} · ${currencyFormatter.format(totals.spend)} investidos`}
      >
        <div className="flex rounded-full bg-gray-100 p-1" role="group" aria-label="Criativo vinculado">
          {([["", "Todos"], ["sim", "Com criativo"], ["nao", "Sem criativo"]] as const).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setMatched(value)}
              aria-pressed={matched === value}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                matched === value ? "bg-white text-blue-900 shadow-sm" : "text-gray-500 hover:text-blue-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Toolbar>
      <SortableTable
        rows={filtered}
        columns={columns}
        defaultSortKey="spend"
        loading={loading}
        emptyLabel="Nenhum anúncio sincronizado ainda."
        onRowClick={onSelect}
        mobileCard={(r) => (
          <MetricCard
            title={r.name}
            subtitle={[r.adset?.campaign?.name, r.adset?.name].filter(Boolean).join(" › ") || undefined}
            status={r.effective_status}
            metrics={r.metrics}
            chip={r.matched_creative ? `Criativo: ${r.matched_creative.name}` : undefined}
          />
        )}
      />
      <p className="mt-2 text-xs text-gray-400">Toque em um anúncio para ver o preview.</p>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  gradient,
  index,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
  gradient: string;
  index: number;
}) {
  return (
    <div
      style={{ animationDelay: `${index * 60}ms` }}
      className="ast-fade-up group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-3.5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
    >
      <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", gradient)} aria-hidden />
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110", gradient)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-lg font-bold tabular-nums text-blue-900 sm:text-xl">{value}</p>
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
          {hint && <p className="truncate text-[10px] text-gray-400">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

interface PreviewState {
  adName: string;
  url: string | null;
  loading: boolean;
  error: string | null;
}

export function TrafficAdsTable() {
  const supabase = createClient();
  const [tab, setTab] = useState<"campaigns" | "adsets" | "ads">("campaigns");
  const [structure, setStructure] = useState<TrafficStructure>({
    campaigns: [],
    adSets: [],
    ads: [],
    insights: [],
    minDate: null,
    maxDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  async function load() {
    const result = await loadTrafficStructure(supabase);
    setStructure(result);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["meta_campaigns", "meta_ad_sets", "meta_ads", "meta_ad_insights"], load);

  const data = useMemo(() => aggregateTraffic(structure, dateRange), [structure, dateRange]);

  const selectedCampaign = useMemo(
    () => data.campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [data.campaigns, selectedCampaignId]
  );
  const selectedAdSet = useMemo(
    () => data.adSets.find((a) => a.id === selectedAdSetId) ?? null,
    [data.adSets, selectedAdSetId]
  );

  const adSetRows = useMemo(
    () => (selectedCampaignId ? data.adSets.filter((a) => a.campaign_id === selectedCampaignId) : data.adSets),
    [data.adSets, selectedCampaignId]
  );
  const adRows = useMemo(() => {
    if (selectedAdSetId) return data.ads.filter((a) => a.adset_id === selectedAdSetId);
    if (selectedCampaignId) return data.ads.filter((a) => a.adset?.campaign?.id === selectedCampaignId);
    return data.ads;
  }, [data.ads, selectedAdSetId, selectedCampaignId]);

  // Totais do período para os cartões do topo: seguem o nível/filtro em foco.
  const totals = useMemo(() => {
    const rows = tab === "ads" ? adRows : tab === "adsets" ? adSetRows : data.campaigns;
    return rows.reduce((acc, r) => addUp(acc, r.metrics), zero());
  }, [tab, adRows, adSetRows, data.campaigns]);

  function selectCampaign(campaign: CampaignRow) {
    setSelectedCampaignId(campaign.id);
    setSelectedAdSetId(null);
    setTab("adsets");
  }

  function selectAdSet(adSet: AdSetRow) {
    setSelectedCampaignId(adSet.campaign_id);
    setSelectedAdSetId(adSet.id);
    setTab("ads");
  }

  function clearCampaign() {
    setSelectedCampaignId(null);
    setSelectedAdSetId(null);
  }

  function clearAdSet() {
    setSelectedAdSetId(null);
  }

  async function openPreview(ad: AdRow) {
    setPreview({ adName: ad.name, url: null, loading: true, error: null });
    try {
      const res = await fetch(`/api/meta-ads/preview?metaAdId=${encodeURIComponent(ad.meta_ad_id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao gerar preview");
      setPreview({ adName: ad.name, url: json.previewUrl, loading: false, error: null });
    } catch (err) {
      setPreview({ adName: ad.name, url: null, loading: false, error: err instanceof Error ? err.message : "Erro desconhecido" });
    }
  }

  function quickRange(days: number) {
    const today = todayBRT();
    setDateRange({ since: shiftDate(today, -(days - 1)), until: today });
  }
  function allRange() {
    if (structure.minDate) setDateRange({ since: structure.minDate, until: structure.maxDate ?? todayBRT() });
  }
  const today = todayBRT();
  const rangeDays = (() => {
    if (dateRange.until !== today) return null;
    const days = Math.round((Date.parse(`${dateRange.until}T12:00:00Z`) - Date.parse(`${dateRange.since}T12:00:00Z`)) / 86400000) + 1;
    return [7, 14, 30, 60].includes(days) ? days : null;
  })();
  const isAll = !!structure.minDate && dateRange.since === structure.minDate;

  const ctr = ctrOf(totals);
  const costPerConversion = totals.conversions > 0 ? totals.spend / totals.conversions : null;
  const levelLabel = tab === "ads" ? "anúncios" : tab === "adsets" ? "conjuntos" : "campanhas";

  const levels = [
    { key: "campaigns" as const, label: "Campanhas", icon: Megaphone, count: data.campaigns.length },
    { key: "adsets" as const, label: "Conjuntos", icon: Layers, count: adSetRows.length },
    { key: "ads" as const, label: "Anúncios", icon: ImageIcon, count: adRows.length },
  ];

  return (
    <div>
      {/* Período */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-3xl border border-gray-200 bg-white p-3 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap gap-1.5">
          {([7, 14, 30, 60] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => quickRange(d)}
              aria-pressed={rangeDays === d}
              className={cn(
                "rounded-full border px-3.5 py-2 text-xs font-bold transition-all active:scale-95 sm:py-1.5",
                rangeDays === d ? "border-transparent bg-blue-900 text-white shadow-sm" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-050"
              )}
            >
              {d} dias
            </button>
          ))}
          <button
            type="button"
            onClick={allRange}
            disabled={!structure.minDate}
            aria-pressed={isAll}
            className={cn(
              "rounded-full border px-3.5 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-40 sm:py-1.5",
              isAll ? "border-transparent bg-blue-900 text-white shadow-sm" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-050"
            )}
          >
            Tudo
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500 lg:ml-auto">
          <input
            type="date"
            aria-label="De"
            value={dateRange.since}
            max={dateRange.until}
            min={structure.minDate ?? undefined}
            onChange={(e) => e.target.value && setDateRange((r) => ({ ...r, since: e.target.value }))}
            className="h-10 rounded-full border border-gray-200 bg-white px-3 text-sm text-blue-900 outline-none focus:border-blue-900 focus:shadow-[var(--shadow-focus)] sm:h-9"
          />
          até
          <input
            type="date"
            aria-label="Até"
            value={dateRange.until}
            min={dateRange.since}
            max={structure.maxDate ?? undefined}
            onChange={(e) => e.target.value && setDateRange((r) => ({ ...r, until: e.target.value }))}
            className="h-10 rounded-full border border-gray-200 bg-white px-3 text-sm text-blue-900 outline-none focus:border-blue-900 focus:shadow-[var(--shadow-focus)] sm:h-9"
          />
        </div>
        {structure.minDate && <p className="w-full text-[11px] text-gray-400">Dados sincronizados desde {formatDay(structure.minDate)}.</p>}
      </div>

      {/* Resumo do período (segue o nível em foco) */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi index={0} icon={Wallet} label="Investido" value={currencyFormatter.format(totals.spend)} hint={`em ${levelLabel}`} gradient="from-sky-500 to-indigo-500" />
        <Kpi index={1} icon={Eye} label="Impressões" value={numberFormatter.format(totals.impressions)} gradient="from-violet-500 to-fuchsia-500" />
        <Kpi index={2} icon={MousePointerClick} label="Cliques no link" value={numberFormatter.format(totals.clicks)} gradient="from-emerald-500 to-teal-500" />
        <Kpi index={3} icon={Percent} label="CTR" value={`${ctr.toFixed(2)}%`} gradient="from-amber-500 to-orange-500" />
        <Kpi
          index={4}
          icon={Target}
          label="Conversões"
          value={numberFormatter.format(totals.conversions)}
          hint={costPerConversion !== null ? `${currencyFormatter.format(costPerConversion)} por conversão` : undefined}
          gradient="from-rose-500 to-pink-500"
        />
      </div>

      {/* Nível: campanhas → conjuntos → anúncios */}
      <div className="mb-3 grid grid-cols-3 gap-2" role="tablist" aria-label="Nível">
        {levels.map((l, i) => {
          const Icon = l.icon;
          const active = tab === l.key;
          return (
            <button
              key={l.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(l.key)}
              className={cn(
                "group relative flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-2.5 transition-all duration-200 active:scale-[0.98] sm:flex-row sm:justify-center sm:gap-2.5 sm:py-3",
                active ? "border-transparent bg-gradient-to-r from-blue-900 to-sky-800 text-white shadow-md" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              )}
            >
              <Icon className={cn("h-5 w-5 transition-transform duration-200 group-hover:scale-110", active ? "text-yellow-400" : "text-blue-700")} />
              <span className="text-center leading-tight">
                <span className="block text-xs font-bold sm:text-sm">{l.label}</span>
                <span className={cn("block text-[11px] font-semibold", active ? "text-blue-100" : "text-gray-400")}>{l.count}</span>
              </span>
              {i < levels.length - 1 && (
                <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-white text-gray-300 sm:block" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {(selectedCampaign || selectedAdSet) && (
        <div className="ast-fade-up mb-3 flex flex-wrap items-center gap-2">
          {selectedCampaign && (
            <button
              onClick={clearCampaign}
              className="flex max-w-full items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-900 transition-colors hover:bg-blue-200"
            >
              <span className="truncate">Campanha: {selectedCampaign.name}</span>
              <X className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}
          {selectedAdSet && (
            <button
              onClick={clearAdSet}
              className="flex max-w-full items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-900 transition-colors hover:bg-blue-200"
            >
              <span className="truncate">Conjunto: {selectedAdSet.name}</span>
              <X className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}
        </div>
      )}

      <div key={tab} className="ast-fade-up">
        {tab === "campaigns" && <CampaignsSection rows={data.campaigns} loading={loading} onSelect={selectCampaign} />}
        {tab === "adsets" && (
          <AdSetsSection rows={adSetRows} loading={loading} showCampaign={!selectedCampaignId} onSelect={selectAdSet} />
        )}
        {tab === "ads" && (
          <AdsSection rows={adRows} loading={loading} showCampaign={!selectedCampaignId && !selectedAdSetId} onSelect={openPreview} />
        )}
      </div>

      <Dialog open={!!preview} onClose={() => setPreview(null)} size="lg">
        <DialogHeader title="Preview do anúncio" subtitle={preview?.adName} onClose={() => setPreview(null)} />
        <DialogBody className="flex justify-center">
          {preview?.loading && <p className="py-10 text-sm text-gray-500">Carregando preview...</p>}
          {preview?.error && <p className="py-10 text-sm text-[color:var(--color-danger)]">{preview.error}</p>}
          {preview?.url && (
            <iframe
              src={preview.url}
              className="h-[min(600px,70dvh)] w-full max-w-sm rounded-xl border border-gray-200"
              title={`Preview — ${preview.adName}`}
            />
          )}
        </DialogBody>
      </Dialog>
    </div>
  );
}
