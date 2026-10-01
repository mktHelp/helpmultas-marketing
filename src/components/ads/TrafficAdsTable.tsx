"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
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
import { cn } from "@/lib/utils";

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

function statusTone(status: string): "success" | "neutral" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "PAUSED") return "neutral";
  return "danger";
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
}: {
  rows: T[];
  columns: Column<T>[];
  emptyLabel: string;
  defaultSortKey?: string;
  onRowClick?: (row: T) => void;
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

  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs font-bold uppercase text-gray-500">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn("sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)]", col.widthClass)}
              >
                {col.sortValue ? (
                  <button
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "flex items-center gap-1 uppercase hover:text-blue-900",
                      sortKey === col.key && "text-blue-900"
                    )}
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
          {sortedRows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn("border-b border-gray-100 last:border-0", onRowClick && "cursor-pointer hover:bg-gray-050")}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-400">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
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

function SummaryLine({ count, label, metrics }: { count: number; label: string; metrics: Metrics }) {
  return (
    <span className="ml-auto text-xs text-gray-500">
      {count} {label} · {currencyFormatter.format(metrics.spend)} investidos no período
    </span>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase text-gray-500">{label}</p>
      {children}
    </div>
  );
}

function CampaignsSection({
  rows,
  loading,
  onSelect,
}: {
  rows: CampaignRow[];
  loading: boolean;
  onSelect: (campaign: CampaignRow) => void;
}) {
  const { name, setName, filtered } = useNameFilter(rows, (r) => r.name);
  const totals = useMemo(() => filtered.reduce((acc, r) => addUp(acc, r.metrics), zero()), [filtered]);

  const columns: Column<CampaignRow>[] = [
    { key: "name", label: "Campanha", widthClass: "min-w-72", sortValue: (r) => r.name, render: (r) => <span className="font-semibold text-blue-900">{r.name}</span> },
    { key: "objective", label: "Objetivo", widthClass: "w-40", sortValue: (r) => r.objective, render: (r) => r.objective || "—" },
    { key: "status", label: "Status", widthClass: "w-32", render: (r) => <Badge tone={statusTone(r.status)}>{r.status || "—"}</Badge> },
    { key: "budget", label: "Orçamento diário", widthClass: "w-36", sortValue: (r) => r.daily_budget ?? 0, render: (r) => (r.daily_budget ? currencyFormatter.format(r.daily_budget) : "—") },
    { key: "adsets", label: "Conjuntos", widthClass: "w-24", sortValue: (r) => r.adSetsCount, render: (r) => numberFormatter.format(r.adSetsCount) },
    { key: "ads", label: "Anúncios", widthClass: "w-24", sortValue: (r) => r.adsCount, render: (r) => numberFormatter.format(r.adsCount) },
    { key: "spend", label: "Investido", widthClass: "w-32", sortValue: (r) => r.metrics.spend, render: (r) => currencyFormatter.format(r.metrics.spend) },
    { key: "impressions", label: "Impressões", widthClass: "w-32", sortValue: (r) => r.metrics.impressions, render: (r) => numberFormatter.format(r.metrics.impressions) },
    { key: "clicks", label: "Cliques no link", widthClass: "w-28", sortValue: (r) => r.metrics.clicks, render: (r) => numberFormatter.format(r.metrics.clicks) },
    { key: "ctr", label: "CTR", widthClass: "w-24", sortValue: (r) => ctrOf(r.metrics), render: (r) => `${ctrOf(r.metrics).toFixed(2)}%` },
    { key: "conversions", label: "Conversões", widthClass: "w-28", sortValue: (r) => r.metrics.conversions, render: (r) => numberFormatter.format(r.metrics.conversions) },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <FilterField label="Buscar">
          <Input className="h-9 w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da campanha..." />
        </FilterField>
        <SummaryLine count={filtered.length} label={filtered.length === 1 ? "campanha" : "campanhas"} metrics={totals} />
      </div>
      <SortableTable
        rows={filtered}
        columns={columns}
        defaultSortKey="spend"
        emptyLabel={loading ? "Carregando..." : "Nenhuma campanha sincronizada ainda."}
        onRowClick={onSelect}
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

  const columns: Column<AdSetRow>[] = [
    { key: "name", label: "Conjunto de anúncios", widthClass: "min-w-64", sortValue: (r) => r.name, render: (r) => <span className="font-semibold text-blue-900">{r.name}</span> },
    ...(showCampaign
      ? [{ key: "campaign", label: "Campanha", widthClass: "min-w-56", sortValue: (r: AdSetRow) => r.campaign?.name ?? "", render: (r: AdSetRow) => r.campaign?.name ?? "—" }]
      : []),
    { key: "status", label: "Status", widthClass: "w-32", render: (r) => <Badge tone={statusTone(r.status)}>{r.status || "—"}</Badge> },
    { key: "goal", label: "Otimização", widthClass: "w-40", sortValue: (r) => r.optimization_goal, render: (r) => r.optimization_goal || "—" },
    { key: "budget", label: "Orçamento diário", widthClass: "w-36", sortValue: (r) => r.daily_budget ?? 0, render: (r) => (r.daily_budget ? currencyFormatter.format(r.daily_budget) : "—") },
    { key: "ads", label: "Anúncios", widthClass: "w-24", sortValue: (r) => r.adsCount, render: (r) => numberFormatter.format(r.adsCount) },
    { key: "spend", label: "Investido", widthClass: "w-32", sortValue: (r) => r.metrics.spend, render: (r) => currencyFormatter.format(r.metrics.spend) },
    { key: "impressions", label: "Impressões", widthClass: "w-32", sortValue: (r) => r.metrics.impressions, render: (r) => numberFormatter.format(r.metrics.impressions) },
    { key: "clicks", label: "Cliques no link", widthClass: "w-28", sortValue: (r) => r.metrics.clicks, render: (r) => numberFormatter.format(r.metrics.clicks) },
    { key: "ctr", label: "CTR", widthClass: "w-24", sortValue: (r) => ctrOf(r.metrics), render: (r) => `${ctrOf(r.metrics).toFixed(2)}%` },
    { key: "conversions", label: "Conversões", widthClass: "w-28", sortValue: (r) => r.metrics.conversions, render: (r) => numberFormatter.format(r.metrics.conversions) },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <FilterField label="Buscar">
          <Input className="h-9 w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder="Conjunto ou campanha..." />
        </FilterField>
        <SummaryLine count={filtered.length} label={filtered.length === 1 ? "conjunto" : "conjuntos"} metrics={totals} />
      </div>
      <SortableTable
        rows={filtered}
        columns={columns}
        defaultSortKey="spend"
        emptyLabel={loading ? "Carregando..." : "Nenhum conjunto de anúncios sincronizado ainda."}
        onRowClick={onSelect}
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
    { key: "status", label: "Status", widthClass: "w-32", render: (r) => <Badge tone={statusTone(r.effective_status)}>{r.effective_status || "—"}</Badge> },
    {
      key: "creative",
      label: "Criativo vinculado",
      widthClass: "w-56",
      render: (r) => (r.matched_creative ? <Badge tone="accent">{r.matched_creative.name}</Badge> : <span className="text-gray-400">Sem vínculo</span>),
    },
    { key: "spend", label: "Investido", widthClass: "w-32", sortValue: (r) => r.metrics.spend, render: (r) => currencyFormatter.format(r.metrics.spend) },
    { key: "impressions", label: "Impressões", widthClass: "w-32", sortValue: (r) => r.metrics.impressions, render: (r) => numberFormatter.format(r.metrics.impressions) },
    { key: "clicks", label: "Cliques no link", widthClass: "w-28", sortValue: (r) => r.metrics.clicks, render: (r) => numberFormatter.format(r.metrics.clicks) },
    { key: "ctr", label: "CTR", widthClass: "w-24", sortValue: (r) => ctrOf(r.metrics), render: (r) => `${ctrOf(r.metrics).toFixed(2)}%` },
    { key: "conversions", label: "Conversões", widthClass: "w-28", sortValue: (r) => r.metrics.conversions, render: (r) => numberFormatter.format(r.metrics.conversions) },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <FilterField label="Buscar">
          <Input className="h-9 w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder="Anúncio, campanha ou conjunto..." />
        </FilterField>
        <FilterField label="Criativo vinculado">
          <div className="w-36">
            <Select className="h-9" value={matched} onChange={(e) => setMatched(e.target.value)}>
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </Select>
          </div>
        </FilterField>
        <SummaryLine count={filtered.length} label={filtered.length === 1 ? "anúncio" : "anúncios"} metrics={totals} />
      </div>
      <SortableTable
        rows={filtered}
        columns={columns}
        defaultSortKey="spend"
        emptyLabel={loading ? "Carregando..." : "Nenhum anúncio sincronizado ainda."}
        onRowClick={onSelect}
      />
      <p className="mt-2 text-xs text-gray-400">Clique num anúncio para ver o preview.</p>
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

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <FilterField label="De">
          <input
            type="date"
            value={dateRange.since}
            max={dateRange.until}
            min={structure.minDate ?? undefined}
            onChange={(e) => setDateRange((r) => ({ ...r, since: e.target.value }))}
            className="h-9 rounded-[14px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
        </FilterField>
        <FilterField label="Até">
          <input
            type="date"
            value={dateRange.until}
            min={dateRange.since}
            max={structure.maxDate ?? undefined}
            onChange={(e) => setDateRange((r) => ({ ...r, until: e.target.value }))}
            className="h-9 rounded-[14px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
        </FilterField>
        {structure.minDate && (
          <p className="pb-2 text-xs text-gray-400">Dados sincronizados desde {formatDay(structure.minDate)}.</p>
        )}
      </div>

      <Tabs
        className="mb-3"
        active={tab}
        onChange={(key) => setTab(key as typeof tab)}
        tabs={[
          { key: "campaigns", label: "Campanhas", count: data.campaigns.length },
          { key: "adsets", label: "Conjuntos de Anúncios", count: adSetRows.length },
          { key: "ads", label: "Anúncios", count: adRows.length },
        ]}
      />

      {(selectedCampaign || selectedAdSet) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {selectedCampaign && (
            <button
              onClick={clearCampaign}
              className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-900 hover:bg-blue-200"
            >
              Campanha: {selectedCampaign.name}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {selectedAdSet && (
            <button
              onClick={clearAdSet}
              className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-900 hover:bg-blue-200"
            >
              Conjunto: {selectedAdSet.name}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {tab === "campaigns" && <CampaignsSection rows={data.campaigns} loading={loading} onSelect={selectCampaign} />}
      {tab === "adsets" && (
        <AdSetsSection rows={adSetRows} loading={loading} showCampaign={!selectedCampaignId} onSelect={selectAdSet} />
      )}
      {tab === "ads" && (
        <AdsSection rows={adRows} loading={loading} showCampaign={!selectedCampaignId && !selectedAdSetId} onSelect={openPreview} />
      )}

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
