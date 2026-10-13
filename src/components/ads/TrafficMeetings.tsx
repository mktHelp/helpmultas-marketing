"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterMultiSelect, FilterSelect } from "@/components/ui/FilterBar";
import { numberFormatter } from "@/lib/format";
import { shiftDate, todayBRT } from "@/lib/period";
import { cn } from "@/lib/utils";
import { fetchCrmLeads, type MeetingLeadRow } from "@/lib/services/meta-ads";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { LeadDeleteDialog, LeadDialogActions, LeadEditDialog, LeadRowActions, type LeadRef } from "./LeadAdmin";
import { LeadDetailDialog } from "./LeadDetail";

const PAGE_SIZE = 25;

const PERIODS = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
];

// Categorias do funil do CRM, na ordem. O casamento é por padrão no nome
// (sem acento/caixa), porque o CRM pode variar "1ª"/"1a", "Reunião"/"Reuniao".
const FUNNEL = [
  { key: "contato", label: "Contato inicial", match: /contato inicial/, color: "#c8102e" },
  { key: "atendimento", label: "Atendimento inicial", match: /atendimento inicial/, color: "#f2a900" },
  { key: "reuniao1", label: "1ª reunião", match: /\b1\s*a?\s*reuni/, color: "#b3bf2a" },
  { key: "cof", label: "Etapa COF", match: /\bcof\b/, color: "#6fb43f" },
  { key: "reuniao2", label: "2ª reunião", match: /\b2\s*a?\s*reuni/, color: "#2f8f6b" },
  { key: "venda", label: "Venda efetivada", match: /venda efetivada/, color: "#1f3a4d" },
] as const;

const LOST = /venda perdida/;

function normalize(v: string | null) {
  return (v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// índice no funil, "lost" (venda perdida), "other" (categoria que não conheço)
// ou null (lead que ainda não está no CRM).
function categoryOf(r: MeetingLeadRow): number | "lost" | "other" | null {
  if (!r.crm_lead_id) return null;
  const c = normalize(r.crm_category_name);
  if (LOST.test(c)) return "lost";
  const i = FUNNEL.findIndex((f) => f.match.test(c));
  return i >= 0 ? i : "other";
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <Card>
      <CardBody>
        <p className="text-[11px] font-bold uppercase text-gray-500">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold", tone === "warn" ? "text-[color:var(--color-danger)]" : "text-blue-900")}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </CardBody>
    </Card>
  );
}

interface FunnelStep {
  label: string;
  color: string;
  reached: number; // leads que chegaram nesta categoria ou além
  now: number; // leads que estão nesta categoria agora
}

// Funil em camadas (cone empilhado). O formato é fixo — a largura de cada camada
// não é proporcional ao volume, os números é que contam a história. Só o cone e
// o número de cada camada ficam no SVG; rótulos e círculos de conversão são HTML
// posicionado em % da altura, pra continuarem legíveis quando o funil encolhe.
const F_W = 400;
const F_CX = F_W / 2;
const F_H = 70;
const F_TOP = 32;
const F_WTOP = 380;
const F_WBOTTOM = 64;
const fWidth = (i: number, n: number) => F_WTOP - ((F_WTOP - F_WBOTTOM) * i) / n;
const fRy = (w: number) => (w / 2) * 0.16;

function FunnelChart({ steps, activeIdx, onSelect }: { steps: FunnelStep[]; activeIdx: number | null; onSelect: (i: number) => void }) {
  const n = steps.length;
  const totalH = F_TOP + n * F_H + fRy(fWidth(n, n)) + 6;
  const topCount = steps[0].reached;

  // Centro visível de cada faixa: as bordas de cima e de baixo são arcos que
  // descem no meio, então o centro real fica abaixo do ponto médio da reta.
  const centers = steps.map((_, i) => {
    const y = F_TOP + i * F_H;
    return y + F_H / 2 + (fRy(fWidth(i, n)) + fRy(fWidth(i + 1, n))) / 2;
  });
  const pctY = (y: number) => `${(y / totalH) * 100}%`;
  // Com uma camada selecionada, as demais ficam esmaecidas.
  const dim = (i: number) => (activeIdx !== null && activeIdx !== i ? 0.35 : 1);

  return (
    <div className="mx-auto grid w-full max-w-[780px] grid-cols-[36%_64%] sm:grid-cols-[1fr_minmax(0,400px)_104px]">
      {/* rótulos */}
      <div className="relative">
        {steps.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSelect(i)}
            title="Filtrar a lista pelos leads que chegaram até aqui"
            className="absolute right-1 -translate-y-1/2 cursor-pointer text-right transition-opacity hover:opacity-100 sm:right-2"
            style={{ top: pctY(centers[i]), opacity: dim(i) }}
          >
            <p className="text-[10px] font-bold uppercase leading-tight sm:text-xs" style={{ color: s.color }}>
              {s.label}
            </p>
            <p className="text-[10px] leading-tight text-gray-500 sm:text-[11px]">{numberFormatter.format(s.now)} aqui agora</p>
            <p className="text-[10px] font-semibold leading-tight text-blue-900 sm:hidden">
              {pct(s.reached, topCount)}
              {i > 0 && ` · ${pct(s.reached, steps[i - 1].reached)} ant.`}
            </p>
          </button>
        ))}
      </div>

      {/* cone */}
      <svg viewBox={`0 0 ${F_W} ${totalH}`} className="block h-auto w-full" role="img" aria-label="Funil de categorias do CRM">
        <ellipse cx={F_CX} cy={F_TOP} rx={F_WTOP / 2} ry={fRy(F_WTOP)} fill={steps[0].color} opacity={0.55} />
        {steps.map((s, i) => {
          const wt = fWidth(i, n);
          const wb = fWidth(i + 1, n);
          const y = F_TOP + i * F_H;
          const rt = wt / 2;
          const rb = wb / 2;
          const d = [
            `M ${F_CX - rt} ${y}`,
            `L ${F_CX - rb} ${y + F_H}`,
            `A ${rb} ${fRy(wb)} 0 0 0 ${F_CX + rb} ${y + F_H}`,
            `L ${F_CX + rt} ${y}`,
            `A ${rt} ${fRy(wt)} 0 0 1 ${F_CX - rt} ${y}`,
            "Z",
          ].join(" ");
          const cy = centers[i];
          const edge = F_CX - (wt + wb) / 4;
          return (
            <g
              key={s.label}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(i)}
              role="button"
              tabIndex={0}
              aria-label={`Filtrar leads que chegaram até ${s.label}`}
              className="cursor-pointer outline-none transition-opacity hover:opacity-100"
              style={{ opacity: dim(i) }}
            >
              <path d={d} fill={s.color} />
              <line x1={0} y1={cy} x2={edge - 2} y2={cy} stroke={s.color} strokeWidth={1.5} strokeDasharray="3 3" />
              <text
                x={F_CX}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={24}
                fontWeight={700}
                fill="#fff"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.18)", strokeWidth: 3 }}
              >
                {numberFormatter.format(s.reached)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* conversão (some no celular; lá vai dentro do rótulo) */}
      <div className="relative hidden sm:block">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className="absolute left-3 flex max-h-[58px] -translate-y-1/2 flex-col items-center justify-center overflow-hidden rounded-full border-[3px] bg-white text-center"
            // ~74% da altura da faixa: sobra folga entre um círculo e o seguinte em qualquer largura.
            style={{ top: pctY(centers[i]), height: `${((F_H * 0.74) / totalH) * 100}%`, aspectRatio: "1 / 1", borderColor: s.color }}
          >
            <span className="text-[13px] font-bold leading-none text-blue-900">{pct(s.reached, topCount)}</span>
            <span className="mt-0.5 text-[9px] leading-none text-gray-500">{i > 0 ? `${pct(s.reached, steps[i - 1].reached)} ant.` : "do topo"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Filter = "all" | "crm" | "none" | "meeting";

const MEETING_FILTERS = [
  { value: "", label: "Todas as reuniões" },
  { value: "none", label: "Sem reunião" },
  { value: "1", label: "Com 1ª reunião ou mais" },
  { value: "2", label: "Com 2ª reunião ou mais" },
  { value: "3", label: "Com 3ª reunião ou mais" },
  { value: "noshow", label: "Com no-show" },
  { value: "resched", label: "Com reagendamento" },
];

const CATEGORY_FILTERS = [
  ...FUNNEL.map((f, i) => ({ value: String(i), label: f.label })),
  { value: "lost", label: "Venda perdida" },
  { value: "other", label: "Outras categorias" },
  { value: "none", label: "Fora do CRM" },
];

const categoryKey = (r: MeetingLeadRow) => String(categoryOf(r) ?? "none");

function meetingMatches(r: MeetingLeadRow, f: string) {
  if (!f) return true;
  if (f === "none") return r.meetings_count === 0;
  if (f === "noshow") return r.meetings_no_show > 0;
  if (f === "resched") return r.meetings_rescheduled > 0;
  return r.meetings_count >= Number(f);
}

export function TrafficMeetings() {
  const [days, setDays] = useState("30");
  const [rows, setRows] = useState<MeetingLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const { isAdmin } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<LeadRef | null>(null);
  const [editing, setEditing] = useState<LeadRef | null>(null);
  const [deleting, setDeleting] = useState<LeadRef | null>(null);
  const [search, setSearch] = useState("");
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [stage, setStage] = useState("");
  const [meetingFilter, setMeetingFilter] = useState("");
  const [meetingStatus, setMeetingStatus] = useState("");
  // Só afetam a lista (não o funil, que precisa continuar inteiro pra ser clicado).
  const [category, setCategory] = useState("");
  const [reachedIdx, setReachedIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const until = todayBRT();
    fetchCrmLeads(createClient(), { since: shiftDate(until, -(Number(days) - 1)), until })
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days, reloadKey]);

  // Exclusão/edição (aqui ou na aba Leads) e novas sincronizações do CRM atualizam a tela.
  useRealtimeChanges(["landing_page_leads"], () => setReloadKey((k) => k + 1));

  useEffect(() => setPage(0), [filter, days, search, campaignIds, stage, meetingFilter, meetingStatus, category, reachedIdx]);

  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const c = one(r.matched_campaign);
      map.set(c?.id ?? "none", c?.name ?? "Sem vínculo");
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [rows]);
  const stageOptions = useMemo(
    () => [...new Set(rows.map((r) => r.crm_stage_name).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows]
  );
  const statusOptions = useMemo(
    () => [...new Set(rows.map((r) => r.last_meeting_status).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows]
  );

  // Filtros gerais: valem pra página toda (cards, funil, tabelas e lista).
  const base = useMemo(() => {
    const term = normalize(search);
    return rows.filter((r) => {
      if (term && !normalize(`${r.name} ${r.phone} ${r.email}`).includes(term)) return false;
      if (campaignIds.length && !campaignIds.includes(one(r.matched_campaign)?.id ?? "none")) return false;
      if (stage && r.crm_stage_name !== stage) return false;
      if (!meetingMatches(r, meetingFilter)) return false;
      if (meetingStatus && r.last_meeting_status !== meetingStatus) return false;
      return true;
    });
  }, [rows, search, campaignIds, stage, meetingFilter, meetingStatus]);

  const hasFilters = !!(search || campaignIds.length || stage || meetingFilter || meetingStatus || category || reachedIdx !== null || filter !== "all");
  function clearFilters() {
    setSearch("");
    setCampaignIds([]);
    setStage("");
    setMeetingFilter("");
    setMeetingStatus("");
    setCategory("");
    setReachedIdx(null);
    setFilter("all");
  }
  function jumpToList() {
    document.getElementById("lista-reunioes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function selectFunnel(i: number) {
    setCategory("");
    setReachedIdx((cur) => (cur === i ? null : i));
    if (reachedIdx !== i) jumpToList();
  }
  function selectCategory(value: string) {
    setReachedIdx(null);
    setCategory(value);
  }

  const stats = useMemo(() => {
    const inCrm = base.filter((r) => r.crm_lead_id);
    return {
      leads: base.length,
      inCrm: inCrm.length,
      notInCrm: base.length - inCrm.length,
      withMeeting: base.filter((r) => r.meetings_count > 0).length,
      meetings: base.reduce((a, r) => a + r.meetings_count, 0),
      noShow: base.reduce((a, r) => a + r.meetings_no_show, 0),
      rescheduled: base.reduce((a, r) => a + r.meetings_rescheduled, 0),
    };
  }, [base]);

  const { steps, lost, other } = useMemo(() => {
    const cats = base.map(categoryOf);
    const steps: FunnelStep[] = FUNNEL.map((f, i) => ({
      label: f.label,
      color: f.color,
      // quem está numa categoria à frente também já passou por esta
      reached: cats.filter((c) => typeof c === "number" && c >= i).length,
      now: cats.filter((c) => c === i).length,
    }));
    return { steps, lost: cats.filter((c) => c === "lost").length, other: cats.filter((c) => c === "other").length };
  }, [base]);

  const byStage = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of base) {
      if (!r.crm_lead_id) continue;
      const k = r.crm_stage_name || "Sem etapa";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [base]);

  const byCampaign = useMemo(() => {
    const map = new Map<string, { id: string; name: string; leads: number; inCrm: number; withMeeting: number; second: number; third: number; noShow: number }>();
    for (const r of base) {
      const c = one(r.matched_campaign);
      const key = c?.id ?? "none";
      const cur = map.get(key) ?? { id: key, name: c?.name ?? "Sem vínculo", leads: 0, inCrm: 0, withMeeting: 0, second: 0, third: 0, noShow: 0 };
      cur.leads++;
      if (r.crm_lead_id) cur.inCrm++;
      if (r.meetings_count > 0) cur.withMeeting++;
      if (r.meetings_count > 1) cur.second++;
      if (r.meetings_count > 2) cur.third++;
      if (r.meetings_no_show > 0) cur.noShow++;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.withMeeting - a.withMeeting || b.leads - a.leads);
  }, [base]);

  // Categoria / clique no funil: só a lista. Os contadores das abas refletem esse recorte.
  const listBase = useMemo(() => {
    return base.filter((r) => {
      const c = categoryOf(r);
      if (reachedIdx !== null && !(typeof c === "number" && c >= reachedIdx)) return false;
      if (category && categoryKey(r) !== category) return false;
      return true;
    });
  }, [base, category, reachedIdx]);

  const filtered = useMemo(() => {
    if (filter === "crm") return listBase.filter((r) => r.crm_lead_id);
    if (filter === "none") return listBase.filter((r) => !r.crm_lead_id);
    if (filter === "meeting") return listBase.filter((r) => r.meetings_count > 0);
    return listBase;
  }, [listBase, filter]);
  const listCounts = {
    all: listBase.length,
    crm: listBase.filter((r) => r.crm_lead_id).length,
    none: listBase.filter((r) => !r.crm_lead_id).length,
    meeting: listBase.filter((r) => r.meetings_count > 0).length,
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const th = "sticky top-0 whitespace-nowrap bg-blue-900 px-4 py-3 text-left text-white";

  return (
    <div className="space-y-6">
      <Tabs tabs={PERIODS} active={days} onChange={setDays} />

      <div className="space-y-3 rounded-3xl border border-gray-100 bg-gray-050/80 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, telefone ou e-mail..." className="sm:max-w-md" />
          <FilterMultiSelect
            label="Campanha"
            allLabel="Todas as campanhas"
            pluralLabel="campanhas"
            options={campaignOptions}
            selected={campaignIds}
            onChange={setCampaignIds}
          />
          <FilterSelect value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Etapa do CRM">
            <option value="">Todas as etapas</option>
            {stageOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </FilterSelect>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect value={category} onChange={(e) => selectCategory(e.target.value)} aria-label="Categoria do CRM">
            <option value="">Todas as categorias</option>
            {CATEGORY_FILTERS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={meetingFilter} onChange={(e) => setMeetingFilter(e.target.value)} aria-label="Reuniões">
            {MEETING_FILTERS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={meetingStatus} onChange={(e) => setMeetingStatus(e.target.value)} aria-label="Status da última reunião">
            <option value="">Todos os status de reunião</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </FilterSelect>
          {reachedIdx !== null && (
            <span className="flex items-center gap-1 rounded-full bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white">
              Funil: chegaram até {FUNNEL[reachedIdx].label}
              <button type="button" onClick={() => setReachedIdx(null)} aria-label="Remover filtro do funil">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-semibold text-blue-900 hover:underline">
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-[color:var(--color-danger)]">{error}</p>}

      {!loading && stats.notInCrm > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/5 px-4 py-3 text-sm text-blue-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[color:var(--color-danger)]" />
          <p className="flex-1">
            <strong>{numberFormatter.format(stats.notInCrm)}</strong> de {numberFormatter.format(stats.leads)} leads da aba Leads ainda{" "}
            <strong>não estão no CRM</strong> ({pct(stats.notInCrm, stats.leads)}). Os mais recentes podem só estar aguardando o próximo envio (a cada 3h).
          </p>
          <button
            onClick={() => {
              setFilter("none");
              document.getElementById("lista-reunioes")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="rounded-full border border-blue-900 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-900 hover:text-white"
          >
            Ver quais são
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Leads (aba Leads)" value={numberFormatter.format(stats.leads)} />
        <Stat label="No CRM" value={numberFormatter.format(stats.inCrm)} hint={`${pct(stats.inCrm, stats.leads)} dos leads`} />
        <Stat label="Fora do CRM" value={numberFormatter.format(stats.notInCrm)} hint={`${pct(stats.notInCrm, stats.leads)} dos leads`} tone={stats.notInCrm > 0 ? "warn" : undefined} />
        <Stat label="Com reunião" value={numberFormatter.format(stats.withMeeting)} hint={`${stats.meetings} reuniões no total`} />
        <Stat label="No-show" value={numberFormatter.format(stats.noShow)} hint={`${pct(stats.noShow, stats.meetings)} das reuniões`} />
        <Stat label="Reagendadas" value={numberFormatter.format(stats.rescheduled)} hint={`${pct(stats.rescheduled, stats.meetings)} das reuniões`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardHeader>
            <CardTitle>Funil por categoria do CRM</CardTitle>
          </CardHeader>
          <CardBody>
            <FunnelChart steps={steps} activeIdx={reachedIdx ?? (/^\d+$/.test(category) ? Number(category) : null)} onSelect={selectFunnel} />
            <p className="mt-2 text-xs text-gray-500">
              O número em cada camada são os leads que chegaram até ali (quem está numa categoria à frente já passou pelas anteriores). Venda perdida fica fora do funil. Clique em uma camada para filtrar a lista abaixo.
            </p>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card
            role="button"
            tabIndex={0}
            onClick={() => {
              selectCategory(category === "lost" ? "" : "lost");
              jumpToList();
            }}
            onKeyDown={(e) => e.key === "Enter" && selectCategory(category === "lost" ? "" : "lost")}
            className={cn("cursor-pointer transition-shadow hover:shadow-md", category === "lost" && "ring-2 ring-[color:var(--color-danger)]")}
          >
            <CardBody>
              <p className="text-[11px] font-bold uppercase text-gray-500">Venda perdida</p>
              <p className="mt-1 text-3xl font-bold text-[color:var(--color-danger)]">{numberFormatter.format(lost)}</p>
              <p className="mt-0.5 text-xs text-gray-500">{pct(lost, stats.inCrm)} dos leads no CRM</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-[11px] font-bold uppercase text-gray-500">Venda efetivada</p>
              <p className="mt-1 text-3xl font-bold text-blue-900">{numberFormatter.format(steps[steps.length - 1].now)}</p>
              <p className="mt-0.5 text-xs text-gray-500">{pct(steps[steps.length - 1].now, stats.leads)} dos leads · {pct(steps[steps.length - 1].now, stats.inCrm)} dos leads no CRM</p>
            </CardBody>
          </Card>
          {other > 0 && (
            <Card>
              <CardBody>
                <p className="text-[11px] font-bold uppercase text-gray-500">Outras categorias</p>
                <p className="mt-1 text-2xl font-bold text-blue-900">{numberFormatter.format(other)}</p>
                <p className="mt-0.5 text-xs text-gray-500">Leads em categorias que não fazem parte do funil acima.</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads por etapa do CRM</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {byStage.length === 0 && <p className="text-sm text-gray-400">{loading ? "Carregando..." : "Nenhum lead do CRM no período."}</p>}
            {byStage.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setStage((cur) => (cur === name ? "" : name));
                  jumpToList();
                }}
                className={cn("block w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-gray-050", stage === name && "bg-yellow-100/60 ring-1 ring-yellow-600/40")}
              >
                <div className="flex justify-between text-sm text-blue-900">
                  <span>{name}</span>
                  <span className="font-semibold">{numberFormatter.format(count)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-blue-900" style={{ width: `${(count / (byStage[0]?.[1] || 1)) * 100}%` }} />
                </div>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reuniões por campanha</CardTitle>
          </CardHeader>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Campanha</th>
                  <th className={th}>Leads</th>
                  <th className={th}>No CRM</th>
                  <th className={th}>1ª</th>
                  <th className={th}>2ª</th>
                  <th className={th}>3ª</th>
                  <th className={th}>Conv.</th>
                  <th className={th}>No-show</th>
                </tr>
              </thead>
              <tbody>
                {byCampaign.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => {
                      setCampaignIds((cur) => (cur.length === 1 && cur[0] === c.id ? [] : [c.id]));
                      jumpToList();
                    }}
                    className={cn("cursor-pointer border-b border-gray-100 text-blue-900 hover:bg-gray-050", campaignIds.length === 1 && campaignIds[0] === c.id && "bg-yellow-100/60")}
                  >
                    <td className="px-4 py-2.5">{c.name}</td>
                    <td className="px-4 py-2.5">{c.leads}</td>
                    <td className="px-4 py-2.5">{c.inCrm}</td>
                    <td className="px-4 py-2.5">{c.withMeeting}</td>
                    <td className="px-4 py-2.5">{c.second}</td>
                    <td className="px-4 py-2.5">{c.third}</td>
                    <td className="px-4 py-2.5">{pct(c.withMeeting, c.leads)}</td>
                    <td className="px-4 py-2.5">{c.noShow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      <Card id="lista-reunioes" className="scroll-mt-4">
        <CardHeader className="items-center">
          <div>
            <CardTitle>Leads</CardTitle>
            <p className="mt-0.5 text-xs text-gray-500">
              {loading ? "Carregando..." : `${numberFormatter.format(filtered.length)} ${filtered.length === 1 ? "lead" : "leads"} · mesma base da aba Leads`}
            </p>
          </div>
          <Tabs
            tabs={[
              { key: "all", label: "Todos", count: listCounts.all },
              { key: "crm", label: "No CRM", count: listCounts.crm },
              { key: "none", label: "Fora do CRM", count: listCounts.none },
              { key: "meeting", label: "Com reunião", count: listCounts.meeting },
            ]}
            active={filter}
            onChange={(k) => setFilter(k as Filter)}
          />
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Lead</th>
                <th className={th}>CRM</th>
                <th className={th}>Campanha</th>
                <th className={th}>Categoria</th>
                <th className={th}>Etapa</th>
                <th className={th}>Reuniões</th>
                <th className={th}>No-show</th>
                <th className={th}>Reag.</th>
                <th className={th}>Última reunião</th>
                <th className={th}>Status</th>
                {isAdmin && <th className={th}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} className="px-4 py-8 text-center text-gray-400">
                    {loading ? "Carregando..." : "Nenhum lead nesse filtro."}
                  </td>
                </tr>
              )}
              {pageRows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected({ id: r.id, name: r.name })}
                  className="cursor-pointer border-b border-gray-100 text-blue-900 transition-colors hover:bg-yellow-050/70"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-semibold">{r.name || "—"}</p>
                    <p className="text-xs text-gray-500">{r.phone}</p>
                  </td>
                  <td className="px-4 py-2.5">{r.crm_lead_id ? <Badge tone="success">No CRM</Badge> : <Badge tone="danger">Fora do CRM</Badge>}</td>
                  <td className="px-4 py-2.5">{one(r.matched_campaign)?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">{r.crm_category_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">{r.crm_stage_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">{r.crm_lead_id ? r.meetings_count : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">{r.crm_lead_id ? r.meetings_no_show : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">{r.crm_lead_id ? r.meetings_rescheduled : <span className="text-gray-300">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{formatDate(r.last_meeting_at)}</td>
                  <td className="px-4 py-2.5">{r.last_meeting_status ? <Badge>{r.last_meeting_status}</Badge> : "—"}</td>
                  {isAdmin && (
                    <td className="px-4 py-2.5">
                      <LeadRowActions
                        onEdit={() => setEditing({ id: r.id, name: r.name })}
                        onDelete={() => setDeleting({ id: r.id, name: r.name })}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-gray-600">
              <span>
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-full border border-gray-200 p-1.5 hover:border-blue-900 disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-full border border-gray-200 p-1.5 hover:border-blue-900 disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <LeadDetailDialog
        leadId={selected?.id ?? null}
        onClose={() => setSelected(null)}
        actions={
          isAdmin && selected ? (
            <LeadDialogActions onEdit={() => setEditing(selected)} onDelete={() => setDeleting(selected)} />
          ) : undefined
        }
      />
      <LeadEditDialog lead={editing} onClose={() => setEditing(null)} onSaved={() => { setSelected(null); setReloadKey((k) => k + 1); }} />
      <LeadDeleteDialog lead={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setSelected(null); setReloadKey((k) => k + 1); }} />
    </div>
  );
}
