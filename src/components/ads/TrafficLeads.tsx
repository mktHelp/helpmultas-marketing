"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Crown, Eye, FileText, Info, Link2, MapPin, MousePointerClick, Phone, Target, Trophy, UserX, Users, X } from "lucide-react";
import Link from "next/link";
import { ScriptLinkDialog } from "./ScriptLinkDialog";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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
import { currencyFormatter, numberFormatter } from "@/lib/format";
import { shiftDate, todayBRT } from "@/lib/period";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterMultiSelect, FilterSelect } from "@/components/ui/FilterBar";
import { Tabs } from "@/components/ui/Tabs";

const PAGE_SIZE = 25;

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
  // Leads do formulário nativo da Meta (campanhas FORMS II), enviados pelo n8n.
  forms: "Formulário nativo",
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

interface AdPreviewState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

// Preview oficial da Meta (iframe) pelo ID do anúncio na Meta, via
// /api/meta-ads/preview — o token da Meta fica só no servidor.
function useAdPreview(metaAdId: string | null | undefined): AdPreviewState {
  const [preview, setPreview] = useState<AdPreviewState>({ url: null, loading: false, error: null });

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

  return preview;
}

function AdPreviewDialog({ ad, onClose }: { ad: { name: string; metaAdId: string } | null; onClose: () => void }) {
  const preview = useAdPreview(ad?.metaAdId);
  return (
    <Dialog open={!!ad} onClose={onClose} size="lg">
      <DialogHeader title="Preview do anúncio" subtitle={ad?.name} onClose={onClose} />
      <DialogBody className="flex justify-center">
        {preview.loading && <p className="py-10 text-sm text-gray-500">Carregando preview...</p>}
        {preview.error && <p className="py-10 text-sm text-[color:var(--color-danger)]">{preview.error}</p>}
        {preview.url && (
          <iframe
            src={preview.url}
            className="h-[min(600px,70dvh)] w-full max-w-sm rounded-xl border border-gray-200"
            title={`Preview — ${ad?.name ?? "anúncio"}`}
          />
        )}
      </DialogBody>
    </Dialog>
  );
}

function LeadDialog({ lead, onClose }: { lead: LeadRow | null; onClose: () => void }) {
  const ad = one(lead?.matched_ad);
  const adset = one(ad?.adset) ?? one(lead?.matched_adset);
  const campaign = one(one(ad?.adset)?.campaign) ?? one(lead?.matched_campaign);
  const metaAdId = ad?.meta_ad_id;
  const preview = useAdPreview(metaAdId);

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
                  className="h-[min(600px,70dvh)] w-full rounded-xl border border-gray-200"
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

function AdThumb({ url, size = "h-14 w-14" }: { url: string | null; size?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={cn("shrink-0 overflow-hidden rounded-xl bg-gray-100", size)}>
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-300">
          <Trophy className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

function RankingCard({
  ranking,
  loading,
  onSelect,
  onLinkScript,
}: {
  ranking: LeadAdRanking;
  loading: boolean;
  onSelect: (ad: { name: string; metaAdId: string }) => void;
  onLinkScript: (item: LeadAdRanking["items"][number]) => void;
}) {
  const { items, totalLeads, matchedLeads } = ranking;
  const max = items[0]?.leads ?? 1;

  return (
    <Card>
      <CardHeader className="flex-wrap items-center gap-2">
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
        {items.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MousePointerClick className="h-3.5 w-3.5" /> Toque em um anúncio para ver o preview
          </span>
        )}
      </CardHeader>
      <CardBody>
        {loading && <p className="py-6 text-center text-sm text-gray-400">Carregando...</p>}
        {!loading && items.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">Nenhum lead vinculado a anúncio no período.</p>
        )}
        {items.length > 0 && (
          <div className="space-y-2.5">
            {items.map((item, i) => (
              <div
                key={item.adId}
                role={item.metaAdId ? "button" : undefined}
                tabIndex={item.metaAdId ? 0 : undefined}
                onClick={() => item.metaAdId && onSelect({ name: item.adName, metaAdId: item.metaAdId })}
                onKeyDown={(e) => {
                  if (item.metaAdId && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelect({ name: item.adName, metaAdId: item.metaAdId });
                  }
                }}
                title={item.metaAdId ? "Ver preview do anúncio" : undefined}
                className={cn(
                  "group flex w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border p-3 text-left transition-colors",
                  "kb-card-in",
                  i === 0 ? "border-yellow-400/70 bg-gradient-to-r from-yellow-050 to-white shadow-[var(--shadow-sm)]" : "border-gray-200 bg-white",
                  item.metaAdId ? "cursor-pointer hover:border-blue-900/30 hover:shadow-[var(--shadow-sm)]" : "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm",
                    i === 0 && "bg-gradient-to-br from-yellow-300 to-amber-500 text-blue-900",
                    i === 1 && "bg-gradient-to-br from-gray-200 to-gray-400 text-blue-900",
                    i === 2 && "bg-gradient-to-br from-orange-300 to-orange-600 text-white",
                    i > 2 && "bg-gray-100 text-gray-600"
                  )}
                >
                  {i === 0 ? <Crown className="h-4 w-4" /> : i + 1}
                </span>
                <AdThumb url={item.thumbnailUrl} />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-blue-900" title={item.adName}>
                    {item.adName}
                  </p>
                  {item.campaignName && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-gray-500" title={`${item.campaignName} › ${item.adsetName ?? ""}`}>
                      {item.campaignName}
                      {item.adsetName ? ` › ${item.adsetName}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex w-full items-center gap-4 sm:w-auto sm:min-w-[300px] lg:w-[420px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-blue-900">
                      {numberFormatter.format(item.leads)} {item.leads === 1 ? "lead" : "leads"}
                      <span className="ml-1 text-[11px] font-normal text-gray-400">· {item.share.toFixed(1)}%</span>
                    </p>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className={cn("h-full rounded-full transition-all duration-700", i === 0 ? "bg-gradient-to-r from-yellow-400 to-amber-500" : "bg-gradient-to-r from-sky-300 to-indigo-300")} style={{ width: `${(item.leads / max) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{currencyFormatter.format(item.spend)}</p>
                    <p className="text-[10px] font-bold uppercase text-gray-400">Investido</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-900">
                      {item.cpl !== null ? currencyFormatter.format(item.cpl) : <span className="font-normal text-gray-300">—</span>}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-gray-400">CPL</p>
                  </div>
                </div>
                {item.metaAdId && <Eye className="hidden h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-blue-900 lg:block" />}

                {/* Roteiro de origem do anúncio */}
                <div className="flex w-full flex-wrap items-center gap-2 border-t border-gray-100 pt-2.5" onClick={(e) => e.stopPropagation()}>
                  {item.script ? (
                    <>
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-blue-050 px-3 py-1 text-xs font-bold text-blue-900">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-blue-700" />
                        <span className="truncate">Roteiro: {item.script.title}</span>
                      </span>
                      <Link href={`/teleprompter?roteiro=${item.script.id}`} className="rounded-full px-2.5 py-1 text-xs font-bold text-blue-800 hover:bg-blue-050">
                        Abrir
                      </Link>
                      <button type="button" onClick={() => onLinkScript(item)} className="rounded-full px-2.5 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-blue-900">
                        Trocar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onLinkScript(item)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3.5 py-1.5 text-xs font-bold text-gray-600 transition-all hover:border-yellow-500 hover:bg-yellow-050 hover:text-blue-900 active:scale-95"
                    >
                      <Link2 className="h-3.5 w-3.5" /> Vincular roteiro
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <details className="mt-3 rounded-xl bg-blue-050 px-4 py-2.5 text-xs text-blue-900">
            <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
              <Info className="h-3.5 w-3.5" /> Como ler este ranking
            </summary>
            <p className="mt-2 text-blue-900/80">
              <strong>Leads:</strong> formulários recebidos pela Landing Page que vieram desse anúncio (identificado pelas UTMs).{" "}
              <strong>Investido:</strong> gasto do anúncio na Meta no período. <strong>CPL:</strong> investido ÷ leads.
            </p>
          </details>
        )}
      </CardBody>
    </Card>
  );
}

function StatCard({
  label,
  icon: Icon,
  value,
  valueClass,
  hint,
  percent,
  barClass,
  gradient,
  index = 0,
  active,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  valueClass?: string;
  hint?: string;
  percent?: number;
  barClass?: string;
  gradient: string;
  index?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        "ast-fade-up group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-[var(--shadow-sm)] transition-all duration-200",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:translate-y-0",
        active && "border-yellow-500 ring-2 ring-yellow-500"
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", gradient)} aria-hidden />
      <div className="flex items-start gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110", gradient)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
          <p className={cn("font-display text-2xl font-bold tabular-nums text-blue-900", valueClass)}>{value}</p>
        </div>
      </div>
      {percent !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className={cn("h-full rounded-full transition-all duration-700", barClass)} style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
      )}
      {hint && <p className="mt-1.5 line-clamp-2 text-[11px] text-gray-400">{hint}</p>}
    </Tag>
  );
}

function StatsCards({
  total,
  matched,
  unmatched,
  ranking,
  active,
  onFilter,
}: {
  total: number;
  matched: number;
  unmatched: number;
  ranking: LeadAdRanking;
  active: "" | "matched" | "unmatched";
  onFilter: (status: "matched" | "unmatched") => void;
}) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const best = ranking.items.filter((i) => i.cpl !== null).sort((a, b) => (a.cpl as number) - (b.cpl as number))[0];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard index={0} gradient="from-sky-500 to-indigo-500" label="Total de leads" icon={Users} value={numberFormatter.format(total)} hint="Recebidos no período" />
      <StatCard
        index={1}
        gradient="from-emerald-500 to-teal-500"
        label="Vinculados a anúncio"
        icon={CheckCircle2}
        value={numberFormatter.format(matched)}
        valueClass="text-green-600"
        percent={pct(matched)}
        barClass="bg-green-500"
        hint={total > 0 ? `${pct(matched).toFixed(1)}% do total · toque para filtrar` : undefined}
        active={active === "matched"}
        onClick={() => onFilter("matched")}
      />
      <StatCard
        index={2}
        gradient="from-amber-500 to-orange-500"
        label="Sem vínculo"
        icon={UserX}
        value={numberFormatter.format(unmatched)}
        valueClass="text-orange-500"
        percent={pct(unmatched)}
        barClass="bg-orange-400"
        hint={total > 0 ? `${pct(unmatched).toFixed(1)}% do total · toque para filtrar` : undefined}
        active={active === "unmatched"}
        onClick={() => onFilter("unmatched")}
      />
      <StatCard
        index={3}
        gradient="from-rose-500 to-pink-500"
        label="Melhor custo por lead"
        icon={Target}
        value={best ? currencyFormatter.format(best.cpl as number) : "—"}
        valueClass="text-blue-900"
        hint={best ? best.adName : "Sem investimento vinculado"}
      />
    </div>
  );
}

export function TrafficLeads() {
  const supabase = createClient();
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [adIds, setAdIds] = useState<string[]>([]);
  const [matchStatus, setMatchStatus] = useState<"" | "matched" | "unmatched">("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<LeadAdRanking>({ items: [], totalLeads: 0, matchedLeads: 0 });
  const [rankingLoading, setRankingLoading] = useState(true);
  const [linkAd, setLinkAd] = useState<{ adId: string; adName: string; current: { id: string; title: string } | null } | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [ads, setAds] = useState<{ id: string; name: string }[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [pageOrigin, setPageOrigin] = useState("");
  const [previewAd, setPreviewAd] = useState<{ name: string; metaAdId: string } | null>(null);
  const [showUtms, setShowUtms] = useState(false);

  // Link vindo do assistente (?busca=Nome): preenche a busca e abre o período
  // pra trás (o padrão de 7 dias esconderia leads mais antigos).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // ?anuncio=<id do anúncio no Meta>[&nome=...] abre direto o preview do criativo.
    const anuncio = params.get("anuncio")?.trim();
    if (anuncio) setPreviewAd({ name: params.get("nome")?.trim() || "Anúncio", metaAdId: anuncio });
    const busca = params.get("busca")?.trim();
    if (!busca) return;
    const until = defaultDateRange().until;
    setDateRange({ since: `${Number(until.slice(0, 4)) - 1}${until.slice(4)}`, until });
    setSearchInput(busca);
    setSearch(busca);
  }, []);

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
    () => ({ range: dateRange, search, campaignIds, adIds, matchStatus, pageOrigin, page, pageSize: PAGE_SIZE }),
    [dateRange, search, campaignIds, adIds, matchStatus, pageOrigin, page]
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
  }, [dateRange, search, campaignIds, adIds, matchStatus, pageOrigin]);

  // Busca ao vivo: aplica 350 ms depois da última tecla (sem botão de lupa).
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  function quickRange(days: number) {
    const today = todayBRT();
    setDateRange({ since: shiftDate(today, -(days - 1)), until: today });
  }
  const rangeDays = (() => {
    const today = todayBRT();
    if (dateRange.until !== today) return null;
    const days = Math.round((Date.parse(`${dateRange.until}T12:00:00Z`) - Date.parse(`${dateRange.since}T12:00:00Z`)) / 86400000) + 1;
    return [1, 7, 30].includes(days) ? days : null;
  })();

  const hasFilters = !!(searchInput || campaignIds.length || adIds.length || pageOrigin || matchStatus);
  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setCampaignIds([]);
    setAdIds([]);
    setPageOrigin("");
    setMatchStatus("");
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const matchedTotal = matchStatus === "unmatched" ? 0 : matchStatus === "matched" ? total : undefined;
  const unmatchedTotal = matchStatus === "matched" ? 0 : matchStatus === "unmatched" ? total : undefined;

  function filterByMatch(status: "matched" | "unmatched") {
    setMatchStatus((prev) => (prev === status ? "" : status));
    document.getElementById("lista-leads")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const colCount = 6 + (showUtms ? UTM_COLUMNS.length : 0);
  const th = "sticky top-0 z-20 bg-blue-900 px-4 py-3 text-white";
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <StatsCards
        total={total}
        matched={matchedTotal ?? rows.filter((r) => r.matched_ad_id).length}
        unmatched={unmatchedTotal ?? rows.filter((r) => !r.matched_ad_id).length}
        ranking={ranking}
        active={matchStatus}
        onFilter={filterByMatch}
      />
      <RankingCard ranking={ranking} loading={rankingLoading} onSelect={setPreviewAd} onLinkScript={(item) => setLinkAd({ adId: item.adId, adName: item.adName, current: item.script })} />
      <ScriptLinkDialog ad={linkAd} onClose={() => setLinkAd(null)} onChanged={loadRanking} />

      <Card id="lista-leads" className="scroll-mt-4">
        <CardHeader className="items-center">
          <div>
            <CardTitle>Lista de leads</CardTitle>
            <p className="mt-0.5 text-xs text-gray-500">
              {loading ? "Carregando..." : `${numberFormatter.format(total)} ${total === 1 ? "lead" : "leads"} no período · clique em um lead para ver os detalhes e o preview do anúncio`}
            </p>
          </div>
          <button
            onClick={() => setShowUtms((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              showUtms ? "border-blue-900 bg-blue-900 text-white" : "border-gray-200 text-gray-700 hover:border-blue-900 hover:text-blue-900"
            )}
          >
            {showUtms ? "Ocultar UTMs" : "Mostrar UTMs"}
          </button>
        </CardHeader>
        <CardBody>
          {/* Filtros */}
          <div className="mb-4 space-y-3 rounded-3xl border border-gray-100 bg-gray-050/80 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Buscar por nome, e-mail, telefone ou UTM..." className="sm:max-w-md" />
              <Tabs
                tabs={[{ key: "1", label: "Hoje" }, { key: "7", label: "7 dias" }, { key: "30", label: "30 dias" }]}
                active={rangeDays === null ? "" : String(rangeDays)}
                onChange={(k) => quickRange(Number(k))}
              />
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                <input
                  type="date"
                  value={dateRange.since}
                  max={dateRange.until}
                  onChange={(e) => e.target.value && setDateRange((r) => ({ ...r, since: e.target.value }))}
                  className="h-11 rounded-full border border-gray-200 bg-white px-3 text-base text-blue-900 outline-none focus:border-blue-900 focus:shadow-[var(--shadow-focus)] sm:h-10 sm:text-sm"
                />
                até
                <input
                  type="date"
                  value={dateRange.until}
                  min={dateRange.since}
                  onChange={(e) => e.target.value && setDateRange((r) => ({ ...r, until: e.target.value }))}
                  className="h-11 rounded-full border border-gray-200 bg-white px-3 text-base text-blue-900 outline-none focus:border-blue-900 focus:shadow-[var(--shadow-focus)] sm:h-10 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <FilterMultiSelect
                label="Campanha"
                allLabel="Todas as campanhas"
                pluralLabel="campanhas"
                options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
                selected={campaignIds}
                onChange={setCampaignIds}
              />
              <FilterMultiSelect
                label="Anúncio"
                allLabel="Todos os anúncios"
                pluralLabel="anúncios"
                options={ads.map((a) => ({ value: a.id, label: a.name }))}
                selected={adIds}
                onChange={setAdIds}
              />
              <FilterSelect value={pageOrigin} onChange={(e) => setPageOrigin(e.target.value)} aria-label="Página de origem">
                  <option value="">Todas as páginas</option>
                  {Object.entries(PAGE_ORIGIN_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </FilterSelect>
              <div className="flex items-center rounded-full bg-white p-0.5 ring-1 ring-gray-200">
                {([["", "Todos"], ["matched", "Vinculados"], ["unmatched", "Sem vínculo"]] as const).map(([value, label]) => (
                  <button
                    key={value || "all"}
                    onClick={() => setMatchStatus(value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      matchStatus === value ? "bg-blue-900 text-white" : "text-gray-600 hover:text-blue-900"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {hasFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-semibold text-blue-900 hover:underline">
                  <X className="h-3.5 w-3.5" /> Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* Tabela */}
          {/* Celular: cartões */}
          <ul className="space-y-2.5 md:hidden">
            {rows.map((lead, i) => {
              const { ad, adset, campaign } = linkedEntities(lead);
              const origin = ad?.name ?? adset?.name ?? campaign?.name;
              return (
                <li
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                  className="kb-card-in cursor-pointer rounded-2xl border border-gray-200 bg-white p-3.5 shadow-[var(--shadow-sm)] active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 font-display text-sm font-bold text-white">
                      {(lead.name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-blue-900">{lead.name || "—"}</p>
                      <p className="truncate text-xs text-gray-500">{lead.email}</p>
                    </div>
                    <MatchCell lead={lead} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {lead.phone && (
                      <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.state || "—"}
                    </span>
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(lead.received_at)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{pageOriginLabel(lead.page_origin)}</Badge>
                    {origin && <span className="min-w-0 max-w-full truncate rounded-full bg-blue-050 px-2.5 py-0.5 text-[11px] font-semibold text-blue-900">{origin}</span>}
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
                {loading ? "Carregando..." : hasFilters ? "Nenhum lead com esses filtros." : "Nenhum lead encontrado no período."}
              </li>
            )}
          </ul>

          {/* Desktop: tabela */}
          <div className="hidden max-h-[65vh] overflow-auto rounded-3xl border border-gray-200 bg-white md:block">
            <table className={cn("w-full border-collapse text-sm", showUtms ? "min-w-[1900px]" : "min-w-[960px]")}>
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-white">
                  <th className={cn(th, "min-w-56")}>Lead</th>
                  <th className={cn(th, "min-w-32")}>Cidade/UF</th>
                  <th className={cn(th, "min-w-28")}>Origem</th>
                  <th className={cn(th, "min-w-72")}>Anúncio de origem</th>
                  <th className={cn(th, "min-w-40")}>Vínculo</th>
                  {showUtms &&
                    UTM_COLUMNS.map((c) => (
                      <th key={c.key} className={cn(th, "normal-case", c.width)}>{c.key}</th>
                    ))}
                  <th className={cn(th, "min-w-36")}>Recebido em</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => {
                  const { ad, adset, campaign } = linkedEntities(lead);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-yellow-050/70"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 font-display text-xs font-bold text-white">
                            {(lead.name || "?").trim().charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-blue-900">{lead.name || "—"}</p>
                            <p className="truncate text-xs text-gray-600">{lead.email}</p>
                            <p className="text-xs text-gray-400">{lead.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.state || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="neutral">{pageOriginLabel(lead.page_origin)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {ad || adset || campaign ? (
                          <>
                            <p className="line-clamp-1 max-w-[420px] font-semibold text-blue-900" title={ad?.name ?? adset?.name ?? campaign?.name}>
                              {ad?.name ?? adset?.name ?? campaign?.name}
                            </p>
                            <p className="line-clamp-1 max-w-[420px] text-xs text-gray-500" title={`${campaign?.name ?? ""} › ${adset?.name ?? ""}`}>
                              {[campaign?.name, ad ? adset?.name : null].filter(Boolean).join(" › ")}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><MatchCell lead={lead} /></td>
                      {showUtms &&
                        UTM_COLUMNS.map((c) => (
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
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-gray-400">
                      {loading ? "Carregando..." : hasFilters ? "Nenhum lead com esses filtros." : "Nenhum lead encontrado no período."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              {total > 0 ? `Mostrando ${from}–${to} de ${numberFormatter.format(total)}` : "Nenhum resultado"}
              {totalPages > 1 ? ` · Página ${page + 1} de ${totalPages}` : ""}
            </p>
            {totalPages > 1 && (
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
            )}
          </div>

          <details className="mt-3 rounded-xl bg-blue-050 px-4 py-2.5 text-xs text-blue-900">
            <summary className="cursor-pointer font-semibold">Como ler esta lista</summary>
            <p className="mt-2 text-blue-900/80">
              <strong>Origem</strong> é a página da LP onde o formulário foi preenchido (não é a <code>utm_source</code>).{" "}
              <strong>Anúncio de origem</strong> mostra o anúncio (ou conjunto/campanha) identificado pelas UTMs.{" "}
              <strong>Sem vínculo</strong> significa que as UTMs do lead não bateram com nenhuma campanha, conjunto ou anúncio
              sincronizado; a cada sincronização o sistema tenta vincular de novo. Use “Mostrar UTMs” para ver as UTMs
              exatamente como vieram na URL.
            </p>
          </details>
        </CardBody>
      </Card>

      <LeadDialog lead={selectedLead} onClose={() => setSelectedLead(null)} />
      <AdPreviewDialog ad={previewAd} onClose={() => setPreviewAd(null)} />
    </div>
  );
}
