"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, Trophy, UserX } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { createClient } from "@/lib/supabase/client";
import {
  defaultDateRange,
  fetchLeadAdRanking,
  fetchLeads,
  type DateRange,
  type LeadAdRanking,
  type LeadRow,
  type LeadsFilter,
} from "@/lib/services/meta-ads";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { currencyFormatter, formatDay, numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase text-gray-500">{label}</p>
      {children}
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

const MATCHED_BY_LABEL: Record<string, string> = {
  ad_id: "por ID do anúncio",
  ad_name: "por nome do anúncio",
  adset_id: "por ID do conjunto",
  adset_name: "por nome do conjunto",
  campaign_id: "por ID da campanha",
  campaign_name: "por nome da campanha",
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

function linkedEntities(lead: LeadRow) {
  const ad = one(lead.matched_ad);
  const adset = one(ad?.adset) ?? one(lead.matched_adset);
  const campaign = one(one(ad?.adset)?.campaign) ?? one(lead.matched_campaign);
  return { ad, adset, campaign };
}

// Uma linha só, cortada com reticências (nome completo no tooltip): as
// colunas separadas dispensam o empilhamento que deixava a linha alta.
function NameCell({ name }: { name?: string | null }) {
  if (!name) return <span className="text-gray-300">—</span>;
  return (
    <div className="w-56 truncate text-sm text-blue-900" title={name}>
      {name}
    </div>
  );
}

function MatchCell({ lead }: { lead: LeadRow }) {
  const { ad, adset, campaign } = linkedEntities(lead);
  if (!ad && !adset && !campaign) return <Badge tone="danger">Sem vínculo</Badge>;
  const label = lead.matched_by ? MATCHED_BY_LABEL[lead.matched_by] ?? lead.matched_by : "Vinculado";
  return <Badge tone="success">{label}</Badge>;
}

// Página da LP onde o formulário foi preenchido — NÃO é utm_source (origem do tráfego).
const PAGE_ORIGIN_LABEL: Record<string, string> = {
  home: "Home",
  evento: "Evento",
};

function pageOriginLabel(value: string) {
  return PAGE_ORIGIN_LABEL[value] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : "—");
}

const UTM_COLUMNS: { key: "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term" | "utm_id"; width: string }[] = [
  { key: "utm_source", width: "min-w-28" },
  { key: "utm_medium", width: "min-w-28" },
  { key: "utm_campaign", width: "min-w-44" },
  { key: "utm_content", width: "min-w-44" },
  { key: "utm_term", width: "min-w-44" },
  { key: "utm_id", width: "min-w-44" },
];

function DetailField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase text-gray-500">{label}</p>
      <p className={cn("break-all text-sm text-blue-900", mono && "font-mono text-xs")}>
        {value ? value : <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 border-b border-gray-100 pb-1 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

interface LeadPreviewState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

function LeadDialog({ lead, onClose }: { lead: LeadRow | null; onClose: () => void }) {
  const [preview, setPreview] = useState<LeadPreviewState>({ url: null, loading: false, error: null });

  const ad = one(lead?.matched_ad);
  const adset = one(ad?.adset) ?? one(lead?.matched_adset);
  const campaign = one(one(ad?.adset)?.campaign) ?? one(lead?.matched_campaign);
  const metaAdId = ad?.meta_ad_id;

  useEffect(() => {
    if (!metaAdId) {
      setPreview({ url: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setPreview({ url: null, loading: true, error: null });
    fetch(`/api/meta-ads/preview?metaAdId=${encodeURIComponent(metaAdId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao gerar preview");
        if (!cancelled) setPreview({ url: json.previewUrl, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setPreview({ url: null, loading: false, error: err instanceof Error ? err.message : "Erro desconhecido" });
      });
    return () => {
      cancelled = true;
    };
  }, [metaAdId]);

  return (
    <Dialog open={!!lead} onClose={onClose} size="xl">
      <DialogHeader title={lead?.name || "Lead"} subtitle={lead ? `Recebido em ${formatDateTime(lead.received_at)}` : undefined} onClose={onClose} />
      <DialogBody>
        {lead && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
            <div className="space-y-5">
              <DetailSection title="Origem do lead">
                <DetailField label="Página de origem (onde preencheu)" value={pageOriginLabel(lead.page_origin)} />
              </DetailSection>

              <DetailSection title="Contato">
                <DetailField label="Nome" value={lead.name} />
                <DetailField label="E-mail" value={lead.email} />
                <DetailField label="Telefone" value={lead.phone} />
                <DetailField label="Cidade / UF" value={lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.city || lead.state} />
                <DetailField label="Capital para investir" value={lead.capital_label} />
                <DetailField label="Valor (capital)" value={lead.capital} />
              </DetailSection>

              <DetailSection title="Origem do anúncio">
                <DetailField label="Campanha" value={campaign?.name} />
                <DetailField label="Conjunto" value={adset?.name} />
                <DetailField label="Anúncio" value={ad?.name} />
                <DetailField label="Como foi vinculado" value={lead.matched_by ? MATCHED_BY_LABEL[lead.matched_by] ?? lead.matched_by : "Sem vínculo"} />
              </DetailSection>

              <DetailSection title="UTMs (como vieram na URL)">
                {UTM_COLUMNS.map((c) => (
                  <DetailField key={c.key} label={c.key} value={lead[c.key]} mono />
                ))}
              </DetailSection>

              <DetailSection title="Rastreamento Meta">
                <DetailField label="fbclid" value={lead.fbclid} mono />
                <DetailField label="fbc" value={lead.fbc} mono />
                <DetailField label="fbp" value={lead.fbp} mono />
              </DetailSection>
            </div>

            <div className="lg:w-[340px]">
              <h3 className="mb-2 border-b border-gray-100 pb-1 text-xs font-bold uppercase tracking-wide text-gray-400">Preview do anúncio</h3>
              {!metaAdId && (
                <p className="rounded-xl bg-gray-050 px-4 py-10 text-center text-sm text-gray-400">
                  Este lead não está vinculado a um anúncio específico, então não há preview.
                </p>
              )}
              {preview.loading && <p className="py-10 text-center text-sm text-gray-500">Carregando preview...</p>}
              {preview.error && <p className="py-10 text-center text-sm text-[color:var(--color-danger)]">{preview.error}</p>}
              {preview.url && (
                <iframe
                  src={preview.url}
                  className="h-[600px] w-full rounded-xl border border-gray-200"
                  title={`Preview — ${ad?.name ?? "anúncio"}`}
                />
              )}
            </div>
          </div>
        )}
      </DialogBody>
    </Dialog>
  );
}

function RankingCard({ ranking, loading }: { ranking: LeadAdRanking; loading: boolean }) {
  const { items, totalLeads, matchedLeads } = ranking;
  const max = items[0]?.leads ?? 1;
  const th = "px-4 py-2.5 text-[11px] font-bold uppercase text-gray-500";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Top anúncios por leads recebidos
          </CardTitle>
          {!loading && totalLeads > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {numberFormatter.format(matchedLeads)} de {numberFormatter.format(totalLeads)}{" "}
              {totalLeads === 1 ? "lead" : "leads"} no período com anúncio identificado
            </p>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {loading && <p className="py-6 text-center text-sm text-gray-400">Carregando...</p>}
        {!loading && items.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">Nenhum lead vinculado a anúncio no período.</p>
        )}
        {items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-050 text-left">
                  <th className={cn(th, "w-14 text-center")}>#</th>
                  <th className={th}>Anúncio</th>
                  <th className={cn(th, "w-64")}>Leads</th>
                  <th className={cn(th, "w-32 text-right")}>Investido</th>
                  <th className={cn(th, "w-36 text-right")}>Custo por lead</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.adId} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                          i === 0 ? "bg-yellow-400 text-blue-900" : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="line-clamp-2 font-semibold leading-snug text-blue-900" title={item.adName}>
                        {item.adName}
                      </p>
                      {item.campaignName && (
                        <p className="mt-0.5 truncate text-xs text-gray-500" title={`${item.campaignName} › ${item.adsetName ?? ""}`}>
                          {item.campaignName}
                          {item.adsetName ? ` › ${item.adsetName}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={cn("h-full rounded-full", i === 0 ? "bg-yellow-400" : "bg-blue-200")}
                            style={{ width: `${(item.leads / max) * 100}%` }}
                          />
                        </div>
                        <div className="w-24 shrink-0 text-right leading-tight">
                          <p className="font-bold text-blue-900">
                            {numberFormatter.format(item.leads)} {item.leads === 1 ? "lead" : "leads"}
                          </p>
                          <p className="text-[11px] text-gray-400">{item.share.toFixed(1)}% do total</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {currencyFormatter.format(item.spend)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-900">
                      {item.cpl !== null ? currencyFormatter.format(item.cpl) : <span className="font-normal text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function StatsCards({
  total,
  matched,
  unmatched,
}: {
  total: number;
  matched: number;
  unmatched: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardBody>
          <p className="text-xs font-bold uppercase text-gray-500">Total de leads</p>
          <p className="mt-1 text-2xl font-bold text-blue-900">{numberFormatter.format(total)}</p>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <p className="text-xs font-bold uppercase text-gray-500">Vinculados a anúncio</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{numberFormatter.format(matched)}</p>
          <p className="text-xs text-gray-400">
            {total > 0 ? `${((matched / total) * 100).toFixed(1)}%` : "—"}
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <p className="flex items-center gap-1 text-xs font-bold uppercase text-gray-500">
            <UserX className="h-3 w-3" /> Sem vínculo
          </p>
          <p className="mt-1 text-2xl font-bold text-orange-500">{numberFormatter.format(unmatched)}</p>
          <p className="text-xs text-gray-400">
            {total > 0 ? `${((unmatched / total) * 100).toFixed(1)}%` : "—"}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export function TrafficLeads() {
  const supabase = createClient();
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [adId, setAdId] = useState("");
  const [matchStatus, setMatchStatus] = useState<"" | "matched" | "unmatched">("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<LeadAdRanking>({ items: [], totalLeads: 0, matchedLeads: 0 });
  const [rankingLoading, setRankingLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [ads, setAds] = useState<{ id: string; name: string }[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [pageOrigin, setPageOrigin] = useState("");

  const matched = useMemo(() => rows.filter((r) => r.matched_ad_id).length, [rows]);

  useEffect(() => {
    Promise.all([
      supabase.from("meta_campaigns").select("id, name").order("name"),
      supabase.from("meta_ads").select("id, name").order("name"),
    ]).then(([c, a]) => {
      setCampaigns((c.data ?? []) as { id: string; name: string }[]);
      setAds((a.data ?? []) as { id: string; name: string }[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filter: LeadsFilter = useMemo(
    () => ({ range: dateRange, search, campaignId, adId, matchStatus, pageOrigin, page, pageSize: PAGE_SIZE }),
    [dateRange, search, campaignId, adId, matchStatus, pageOrigin, page]
  );

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchLeads(supabase, filter);
      setRows(result.rows);
      setTotal(result.total);
    } catch (e) {
      console.error("Erro ao carregar leads:", e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadRanking = useCallback(async () => {
    setRankingLoading(true);
    try {
      const result = await fetchLeadAdRanking(supabase, dateRange);
      setRanking(result);
    } catch (e) {
      console.error("Erro ao carregar ranking:", e);
    } finally {
      setRankingLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  useRealtimeChanges(["landing_page_leads"], () => {
    loadLeads();
    loadRanking();
  });

  useEffect(() => {
    setPage(0);
  }, [dateRange, search, campaignId, adId, matchStatus, pageOrigin]);

  function handleSearch() {
    setSearch(searchInput);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const matchedTotal = matchStatus === "unmatched" ? 0 : matchStatus === "matched" ? total : undefined;
  const unmatchedTotal = matchStatus === "matched" ? 0 : matchStatus === "unmatched" ? total : undefined;

  return (
    <div className="space-y-6">
      <StatsCards
        total={total}
        matched={matchedTotal ?? rows.filter((r) => r.matched_ad_id).length}
        unmatched={unmatchedTotal ?? rows.filter((r) => !r.matched_ad_id).length}
      />
      <RankingCard ranking={ranking} loading={rankingLoading} />

      <Card>
        <CardHeader>
          <CardTitle>Lista de Leads</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <FilterField label="De">
              <input
                type="date"
                value={dateRange.since}
                max={dateRange.until}
                onChange={(e) => setDateRange((r) => ({ ...r, since: e.target.value }))}
                className="h-9 rounded-[14px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </FilterField>
            <FilterField label="Até">
              <input
                type="date"
                value={dateRange.until}
                min={dateRange.since}
                onChange={(e) => setDateRange((r) => ({ ...r, until: e.target.value }))}
                className="h-9 rounded-[14px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </FilterField>
            <FilterField label="Buscar">
              <div className="flex gap-1">
                <Input
                  className="h-9 w-48"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Nome, contato ou UTM..."
                />
                <button
                  onClick={handleSearch}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </FilterField>
            <FilterField label="Campanha">
              <div className="w-48">
                <Select className="h-9" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">Todas</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
            </FilterField>
            <FilterField label="Anúncio">
              <div className="w-48">
                <Select className="h-9" value={adId} onChange={(e) => setAdId(e.target.value)}>
                  <option value="">Todos</option>
                  {ads.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>
            </FilterField>
            <FilterField label="Página de origem">
              <div className="w-40">
                <Select className="h-9" value={pageOrigin} onChange={(e) => setPageOrigin(e.target.value)}>
                  <option value="">Todas</option>
                  {Object.entries(PAGE_ORIGIN_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
            </FilterField>
            <FilterField label="Vínculo">
              <div className="w-36">
                <Select className="h-9" value={matchStatus} onChange={(e) => setMatchStatus(e.target.value as "" | "matched" | "unmatched")}>
                  <option value="">Todos</option>
                  <option value="matched">Vinculado</option>
                  <option value="unmatched">Sem vínculo</option>
                </Select>
              </div>
            </FilterField>
          </div>

          <div className="max-h-[65vh] overflow-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full min-w-[2700px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase text-gray-500">
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-40">Nome</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-52">Contato</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-36">Cidade/UF</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-36">Página de origem</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-56">Campanha</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-56">Conjunto</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-56">Anúncio</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-40">Vínculo</th>
                  {UTM_COLUMNS.map((c) => (
                    <th key={c.key} className={cn("sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] normal-case", c.width)}>
                      {c.key}
                    </th>
                  ))}
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-36">Recebido em</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-050"
                  >
                    <td className="px-4 py-3 font-semibold text-blue-900">{lead.name || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{lead.email}</div>
                      <div className="text-xs text-gray-400">{lead.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.state || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{pageOriginLabel(lead.page_origin)}</Badge>
                    </td>
                    {(() => {
                      const { ad, adset, campaign } = linkedEntities(lead);
                      return (
                        <>
                          <td className="px-4 py-3"><NameCell name={campaign?.name} /></td>
                          <td className="px-4 py-3"><NameCell name={adset?.name} /></td>
                          <td className="px-4 py-3"><NameCell name={ad?.name} /></td>
                          <td className="px-4 py-3"><MatchCell lead={lead} /></td>
                        </>
                      );
                    })()}
                    {UTM_COLUMNS.map((c) => (
                      <td key={c.key} className="px-4 py-3 align-middle">
                        {lead[c.key] ? (
                          <span className="break-all font-mono text-xs text-blue-900">{lead[c.key]}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(lead.received_at)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9 + UTM_COLUMNS.length} className="px-4 py-10 text-center text-sm text-gray-400">
                      {loading ? "Carregando..." : "Nenhum lead encontrado no período."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {numberFormatter.format(total)} {total === 1 ? "lead" : "leads"} · Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <LeadDialog lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
