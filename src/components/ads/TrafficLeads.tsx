"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, Trophy, UserX } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import {
  defaultDateRange,
  fetchLeadAdRanking,
  fetchLeads,
  type DateRange,
  type LeadAdCount,
  type LeadRow,
  type LeadsFilter,
} from "@/lib/services/meta-ads";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { formatDay, numberFormatter } from "@/lib/format";
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

function AdNameCell({ lead }: { lead: LeadRow }) {
  const ad = one(lead.matched_ad);
  const adset = one(ad?.adset) ?? one(lead.matched_adset);
  const campaign = one(one(ad?.adset)?.campaign) ?? one(lead.matched_campaign);
  if (!ad && !adset && !campaign) return <span className="text-gray-400">Sem vínculo</span>;

  const level = ad ? "Anúncio" : adset ? "Conjunto" : "Campanha";
  const title = ad?.name ?? adset?.name ?? campaign?.name;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase text-gray-400">{level}</div>
      <div className="font-medium text-blue-900">{title}</div>
      {(ad || (adset && campaign)) && (
        <div className="text-xs text-gray-400">
          {[campaign?.name, ad ? adset?.name : null].filter(Boolean).join(" › ")}
        </div>
      )}
      {lead.matched_by && (
        <div className="mt-1">
          <Badge tone="success">{MATCHED_BY_LABEL[lead.matched_by] ?? lead.matched_by}</Badge>
        </div>
      )}
    </div>
  );
}

function UtmsCell({ lead }: { lead: LeadRow }) {
  const items: [string, string][] = [
    ["utm_source", lead.utm_source],
    ["utm_medium", lead.utm_medium],
    ["utm_campaign", lead.utm_campaign],
    ["utm_content", lead.utm_content],
    ["utm_term", lead.utm_term],
    ["utm_id", lead.utm_id],
  ];
  const filled = items.filter(([, v]) => v);
  if (filled.length === 0) return <span className="text-gray-400">Sem UTMs</span>;
  return (
    <dl className="space-y-0.5 text-xs">
      {filled.map(([key, value]) => (
        <div key={key} className="flex gap-1.5">
          <dt className="shrink-0 font-semibold text-gray-500">{key}</dt>
          <dd className="break-all font-mono text-blue-900" title={value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RankingCard({ ranking, loading }: { ranking: LeadAdCount[]; loading: boolean }) {
  const max = ranking[0]?.count ?? 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Top anúncios por leads recebidos
        </CardTitle>
      </CardHeader>
      <CardBody>
        {loading && <p className="py-4 text-center text-sm text-gray-400">Carregando...</p>}
        {!loading && ranking.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">Nenhum lead vinculado no período.</p>
        )}
        <div className="space-y-3">
          {ranking.map((item, i) => (
            <div key={item.adId}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 truncate font-medium text-blue-900">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      i === 0 ? "bg-yellow-400 text-blue-900" : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate">{item.adName}</span>
                </span>
                <span className="ml-2 shrink-0 font-bold text-blue-900">
                  {numberFormatter.format(item.count)} {item.count === 1 ? "lead" : "leads"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn("h-full rounded-full", i === 0 ? "bg-yellow-400" : "bg-blue-200")}
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
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
  const [ranking, setRanking] = useState<LeadAdCount[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [ads, setAds] = useState<{ id: string; name: string }[]>([]);

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
    () => ({ range: dateRange, search, campaignId, adId, matchStatus, page, pageSize: PAGE_SIZE }),
    [dateRange, search, campaignId, adId, matchStatus, page]
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
  }, [dateRange, search, campaignId, adId, matchStatus]);

  function handleSearch() {
    setSearch(searchInput);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const matchedTotal = matchStatus === "unmatched" ? 0 : matchStatus === "matched" ? total : undefined;
  const unmatchedTotal = matchStatus === "matched" ? 0 : matchStatus === "unmatched" ? total : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StatsCards
            total={total}
            matched={matchedTotal ?? rows.filter((r) => r.matched_ad_id).length}
            unmatched={unmatchedTotal ?? rows.filter((r) => !r.matched_ad_id).length}
          />
        </div>
        <RankingCard ranking={ranking} loading={rankingLoading} />
      </div>

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
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase text-gray-500">
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-40">Nome</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-44">Contato</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] w-28">Cidade/UF</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-64">Anúncio vinculado</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] min-w-64">UTMs (como vieram na URL)</th>
                  <th className="sticky top-0 z-20 bg-gray-050 px-4 py-3 shadow-[inset_0_-1px_0_var(--gray-200)] w-36">Recebido em</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-semibold text-blue-900">{lead.name || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{lead.email}</div>
                      <div className="text-xs text-gray-400">{lead.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.state || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <AdNameCell lead={lead} />
                    </td>
                    <td className="px-4 py-3">
                      <UtmsCell lead={lead} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(lead.received_at)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
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
    </div>
  );
}
