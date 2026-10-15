"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterButton, FilterChips, FilterDate, type FilterChip } from "@/components/ui/FilterBar";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { EMPTY_MEETING_FILTERS, MeetingsFilterPanel, countMeetingFilters, type MeetingFilters } from "./MeetingsFilterPanel";
import { numberFormatter } from "@/lib/format";
import { shiftDate, todayBRT } from "@/lib/period";
import { cn } from "@/lib/utils";
import { fetchCrmLeads, fetchStageHistoryCategories, type MeetingLeadRow } from "@/lib/services/meta-ads";
import { useAuth } from "@/lib/auth-context";
import { exportLeadsPdf, exportLeadsXlsx, type LeadExportData } from "@/lib/export-leads";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { LeadDeleteDialog, LeadDialogActions, LeadEditDialog, LeadRowActions, type LeadRef } from "./LeadAdmin";
import { LeadDetailDialog } from "./LeadDetail";
import { MeetingStatusBadge, meetingStatusText } from "./MeetingStatus";

const PAGE_SIZE = 25;

const PERIODS = [
  { key: "1", label: "Hoje" },
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "all", label: "Todo o período" },
  { key: "custom", label: "Personalizado" },
];

// Categorias do funil do CRM, na ordem. O casamento é por padrão no nome
// (sem acento/caixa), porque o CRM pode variar "1ª"/"1a", "Reunião"/"Reuniao".
const FUNNEL = [
  { key: "contato", label: "Contato inicial", match: /contato/, color: "#c8102e" },
  { key: "atendimento", label: "Atendimento inicial", match: /atendimento/, color: "#f2a900" },
  { key: "reuniao1", label: "1ª reunião", match: /\b1\s*a?\s*reuni/, color: "#b3bf2a" },
  { key: "cof", label: "Etapa COF", match: /\bcof\b/, color: "#6fb43f" },
  { key: "reuniao2", label: "2ª reunião", match: /\b2\s*a?\s*reuni/, color: "#2f8f6b" },
  { key: "venda", label: "Venda efetivada", match: /efetivad/, color: "#1f3a4d" },
] as const;

const LOST = /perdid/;

// Etapas do CRM por fase (categoria). Serve de apoio quando a fase vem vazia ou
// escrita de outro jeito: "Formulario Nativo" e "Leads para Evento" são etapas SEM
// fase e ficam fora do funil.
const STAGE_RULES: [RegExp, number][] = [
  [/cliente potencial/, 0],
  [/qualifica|sem resposta/, 1],
  [/apresenta|remarcando/, 2],
  [/coletando/, 3],
  [/indicadores|perfil|consulta de dados|contrato/, 4],
];

// Índice no funil de um nome de fase OU de etapa; "lost" para venda perdida; null se não for do funil.
function classify(name: string | null): number | "lost" | null {
  const c = normalize(name);
  if (!c) return null;
  if (LOST.test(c)) return "lost";
  const i = FUNNEL.findIndex((f) => f.match.test(c));
  if (i >= 0) return i;
  return STAGE_RULES.find(([re]) => re.test(c))?.[1] ?? null;
}

function normalize(v: string | null) {
  return (v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// índice no funil, "lost" (venda perdida), "other" (categoria que não conheço)
// ou null (lead que ainda não está no CRM).
function categoryOf(r: MeetingLeadRow): number | "lost" | "other" | null {
  if (!r.crm_lead_id) return null;
  return classify(r.crm_category_name) ?? classify(r.crm_stage_name) ?? "other";
}

// Índice de funil de um nome de categoria (null se não for do funil).
// Fase exibida na tabela: a que o CRM mandou ou, se vier vazia, a deduzida pela etapa
// (a mesma regra que posiciona o lead no funil), marcada como deduzida.
function categoryLabel(r: MeetingLeadRow): { label: string; inferred: boolean } | null {
  if (!r.crm_lead_id) return null;
  if (r.crm_category_name) return { label: r.crm_category_name, inferred: false };
  const c = classify(r.crm_stage_name);
  if (c === "lost") return { label: "Venda perdida", inferred: true };
  if (typeof c === "number") return { label: FUNNEL[c].label, inferred: true };
  return null;
}

function funnelIndex(name: string | null): number | null {
  const c = classify(name);
  return typeof c === "number" ? c : null;
}

const REUNIAO_1 = FUNNEL.findIndex((f) => f.key === "reuniao1");
const REUNIAO_2 = FUNNEL.findIndex((f) => f.key === "reuniao2");

// Até onde o lead chegou no funil (-1 = não é do funil): o maior entre a categoria
// atual, as categorias do histórico e o que as reuniões provam (2 reuniões => já fez
// a 1ª e a 2ª). Venda perdida conta até onde tinha chegado, no mínimo Contato inicial.
function reachOf(r: MeetingLeadRow, historyCats: string[] = []): number {
  const cur = categoryOf(r);
  const evidence = [
    typeof cur === "number" ? cur : -1,
    ...historyCats.map((c) => funnelIndex(c) ?? -1),
    r.crm_lead_id && r.meetings_count >= 2 ? REUNIAO_2 : -1,
    r.crm_lead_id && r.meetings_count >= 1 ? REUNIAO_1 : -1,
  ];
  const best = Math.max(...evidence);
  if (best >= 0) return best;
  return cur === "lost" ? 0 : -1;
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
const F_H = 78; // passo entre camadas
const F_GAP = 14; // vão visível entre uma camada e a seguinte
const F_LH = F_H - F_GAP; // altura desenhada de cada camada
const F_TOP = 32;
const F_WTOP = 380;
const F_WBOTTOM = 64;
const fWidth = (i: number, n: number) => F_WTOP - ((F_WTOP - F_WBOTTOM) * i) / n;
const fRy = (w: number) => (w / 2) * 0.16;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Brilho neutro/ativo da camada, no mesmo formato pra o GSAP interpolar o filter.
const GLOW_OFF = "drop-shadow(0px 0px 0px rgba(0,0,0,0)) brightness(1) saturate(1)";
const GLOW_ON = "drop-shadow(0px 10px 14px rgba(0,0,0,0.35)) brightness(1.06) saturate(1.1)";
const GLOW_DIM = "drop-shadow(0px 0px 0px rgba(0,0,0,0)) brightness(1.03) saturate(0.55)";

function FunnelChart({ steps, activeIdx, onSelect }: { steps: FunnelStep[]; activeIdx: number | null; onSelect: (i: number) => void }) {
  const n = steps.length;
  const totalH = F_TOP + n * F_H - F_GAP + fRy(fWidth(n, n)) + 6;
  const topCount = steps[0].reached;
  const rootRef = useRef<HTMLDivElement>(null);
  const prevCounts = useRef<number[]>(steps.map(() => 0));

  // Centro visível de cada faixa: as bordas de cima e de baixo são arcos que
  // descem no meio, então o centro real fica abaixo do ponto médio da reta.
  const centers = steps.map((_, i) => {
    const y = F_TOP + i * F_H;
    return y + F_LH / 2 + (fRy(fWidth(i, n)) + fRy(fWidth(i + F_LH / F_H, n))) / 2;
  });
  const pctY = (y: number) => `${(y / totalH) * 100}%`;
  // Com uma camada selecionada, as demais ficam esmaecidas.
  const dim = (i: number) => (activeIdx !== null && activeIdx !== i ? 0.35 : 1);

  // Entrada: o cone "desce" camada a camada, rótulos e cartões deslizam dos lados;
  // depois, um respiro contínuo e suave (as camadas alargam/estreitam em onda).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.from(".f-ellipse", { opacity: 0, scaleX: 0.4, transformOrigin: "50% 50%", duration: 0.7, ease: "power2.out" })
        .from(".f-layer", { opacity: 0, y: -40, duration: 0.8, ease: "back.out(1.7)", stagger: 0.12 }, "-=0.35")
        .from(
          ".f-side",
          { opacity: 0, x: (_i, el: HTMLElement) => (el.dataset.side === "l" ? -28 : 28), duration: 0.55, ease: "power3.out", stagger: 0.08 },
          "-=0.8"
        )
        .add(() => {
          gsap.to(".f-layer", {
            scaleX: 1.014,
            transformOrigin: "50% 50%",
            duration: 2.6,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            stagger: 0.3,
          });
          gsap.to(".f-ellipse", { opacity: 0.8, duration: 2.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
        });
    }, root);
    return () => ctx.revert();
  }, []);

  // Contagem: os números sobem até o valor novo sempre que os dados mudam.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const tweens: gsap.core.Tween[] = [];
    root.querySelectorAll<SVGTextElement>("[data-count]").forEach((el, i) => {
      const to = steps[i]?.reached ?? 0;
      const from = prevCounts.current[i] ?? 0;
      if (reducedMotion() || from === to) {
        el.textContent = numberFormatter.format(to);
        return;
      }
      const o = { v: from };
      tweens.push(
        gsap.to(o, {
          v: to,
          duration: 1.3,
          delay: 0.4 + i * 0.1,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = numberFormatter.format(Math.round(o.v));
          },
        })
      );
    });
    prevCounts.current = steps.map((s) => s.reached);
    return () => tweens.forEach((tw) => tw.kill());
  }, [steps]);

  // Hover: a camada "salta" com brilho e sombra, as outras perdem cor, e o rótulo e o
  // cartão da mesma camada avançam em direção ao cone.
  const hover = useCallback((active: number | null) => {
    const root = rootRef.current;
    if (!root || reducedMotion()) return;
    root.querySelectorAll<SVGGElement>(".f-hover").forEach((el) => {
      const on = Number(el.dataset.i) === active;
      gsap.to(el, {
        scale: on ? 1.045 : 1,
        transformOrigin: "50% 50%",
        filter: on ? GLOW_ON : active !== null ? GLOW_DIM : GLOW_OFF,
        duration: 0.4,
        ease: on ? "back.out(2)" : "power3.out",
        overwrite: "auto",
      });
    });
    root.querySelectorAll<HTMLElement>(".f-side").forEach((el) => {
      const on = Number(el.dataset.i) === active;
      const left = el.dataset.side === "l";
      gsap.to(el, {
        scale: on ? 1.07 : 1,
        x: on ? (left ? 8 : -8) : 0,
        transformOrigin: left ? "100% 50%" : "0% 50%",
        boxShadow: on && !left ? "0 8px 20px rgba(31,58,77,0.25)" : "0 1px 2px rgba(0,0,0,0.05)",
        duration: 0.35,
        ease: "power3.out",
        overwrite: "auto",
      });
    });
  }, []);

  return (
    <div
      ref={rootRef}
      onMouseOver={(e) => {
        const el = (e.target as Element).closest<HTMLElement | SVGElement>("[data-i]");
        hover(el ? Number(el.dataset.i) : null);
      }}
      onMouseLeave={() => hover(null)}
      className="mx-auto grid w-full max-w-[780px] grid-cols-[36%_64%] sm:grid-cols-[1fr_minmax(0,400px)_150px]"
    >
      {/* rótulos */}
      <div className="relative">
        {steps.map((s, i) => (
          <button
            key={s.label}
            type="button"
            data-i={i}
            onClick={() => onSelect(i)}
            title="Filtrar a lista pelos leads que chegaram até aqui"
            className="absolute right-1 -translate-y-1/2 cursor-pointer text-right transition-opacity hover:opacity-100 sm:right-2"
            style={{ top: pctY(centers[i]), opacity: dim(i) }}
          >
            <div className="f-side" data-i={i} data-side="l">
              <p className="text-[10px] font-bold uppercase leading-tight sm:text-xs" style={{ color: s.color }}>
                {s.label}
              </p>
              <p className="text-[10px] leading-tight text-gray-500 sm:text-[11px]">{numberFormatter.format(s.now)} aqui agora</p>
              <p className="text-[10px] font-semibold leading-tight text-blue-900 sm:hidden">
                {pct(s.reached, topCount)}
                {i > 0 && ` · ${pct(s.reached, steps[i - 1].reached)} ant.`}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* cone */}
      <svg viewBox={`0 0 ${F_W} ${totalH}`} className="block h-auto w-full overflow-visible" role="img" aria-label="Funil de categorias do CRM">
        <ellipse className="f-ellipse" cx={F_CX} cy={F_TOP} rx={F_WTOP / 2} ry={fRy(F_WTOP)} fill={steps[0].color} opacity={0.55} />
        {steps.map((s, i) => {
          const wt = fWidth(i, n);
          const wb = fWidth(i + F_LH / F_H, n);
          const y = F_TOP + i * F_H;
          const rt = wt / 2;
          const rb = wb / 2;
          const d = [
            `M ${F_CX - rt} ${y}`,
            `L ${F_CX - rb} ${y + F_LH}`,
            `A ${rb} ${fRy(wb)} 0 0 0 ${F_CX + rb} ${y + F_LH}`,
            `L ${F_CX + rt} ${y}`,
            `A ${rt} ${fRy(wt)} 0 0 1 ${F_CX - rt} ${y}`,
            "Z",
          ].join(" ");
          const cy = centers[i];
          const edge = F_CX - (wt + wb) / 4;
          return (
            // g externa: entrada + respiro. g interna: hover e clique (transforms independentes).
            <g key={s.label} className="f-layer">
              <g
                className="f-hover cursor-pointer outline-none"
                data-i={i}
                onClick={() => onSelect(i)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(i)}
                role="button"
                tabIndex={0}
                aria-label={`Filtrar leads que chegaram até ${s.label}`}
                style={{ opacity: dim(i) }}
              >
                <path d={d} fill={s.color} />
                <line x1={0} y1={cy} x2={edge - 2} y2={cy} stroke={s.color} strokeWidth={1.5} strokeDasharray="3 3" />
                <text
                  data-count
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
            </g>
          );
        })}
      </svg>

      {/* conversão (some no celular; lá vai dentro do rótulo) */}
      <div className="relative hidden sm:block">
        {steps.map((s, i) => (
          <div
            key={s.label}
            data-i={i}
            className="absolute left-3 right-0 -translate-y-1/2"
            style={{ top: pctY(centers[i]) }}
          >
            <div
              className="f-side overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 pl-3 pr-2 shadow-sm"
              data-i={i}
              data-side="r"
              style={{ borderLeft: `5px solid ${s.color}` }}
            >
              <p className="flex items-baseline gap-1.5 whitespace-nowrap leading-none">
                <span className="text-base font-bold text-blue-900">{pct(s.reached, topCount)}</span>
                <span className="text-[10px] text-gray-500">do topo</span>
              </p>
              <p className="mt-1 whitespace-nowrap text-[11px] leading-none text-gray-500">
                {i > 0 ? (
                  <>
                    <span className="font-semibold text-blue-900">{pct(s.reached, steps[i - 1].reached)}</span> da anterior
                  </>
                ) : (
                  "base do funil"
                )}
              </p>
            </div>
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
  { value: "other", label: "Sem fase" },
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
  // Período personalizado: começa nos últimos 30 dias.
  const [custom, setCustom] = useState(() => {
    const until = todayBRT();
    return { since: shiftDate(until, -29), until };
  });
  const [rows, setRows] = useState<MeetingLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const { isAdmin } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [historyCats, setHistoryCats] = useState<Map<string, string[]>>(new Map());
  const [selected, setSelected] = useState<LeadRef | null>(null);
  const [editing, setEditing] = useState<LeadRef | null>(null);
  const [deleting, setDeleting] = useState<LeadRef | null>(null);
  // Busca da tabela e clique no funil: só a lista. Os filtros da gaveta valem pra página toda.
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<MeetingFilters>(EMPTY_MEETING_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reachedIdx, setReachedIdx] = useState<number | null>(null);

  // "Todo o período" não limita o início; "Personalizado" usa as datas escolhidas.
  const range = useMemo(() => {
    const until = todayBRT();
    if (days === "all") return { since: "1970-01-01", until };
    if (days === "custom") return custom;
    return { since: shiftDate(until, -(Number(days) - 1)), until };
  }, [days, custom]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCrmLeads(createClient(), range)
      .then(async (r) => {
        if (cancelled) return;
        setRows(r);
        // Histórico de etapas dos leads que estão no CRM, pra marcar o caminho no funil.
        const cats = await fetchStageHistoryCategories(
          createClient(),
          r.filter((x) => x.crm_lead_id).map((x) => x.id)
        ).catch(() => new Map<string, string[]>());
        if (!cancelled) setHistoryCats(cats);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  // Exclusão/edição (aqui ou na aba Leads) e novas sincronizações do CRM atualizam a tela.
  useRealtimeChanges(["landing_page_leads"], () => setReloadKey((k) => k + 1));

  useEffect(() => setPage(0), [filter, days, search, filters, reachedIdx]);

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

  // Filtros da gaveta: valem pra página toda (cards, funil, tabelas e lista).
  const base = useMemo(() => {
    return rows.filter((r) => {
      if (filters.campaignIds.length && !filters.campaignIds.includes(one(r.matched_campaign)?.id ?? "none")) return false;
      if (filters.stages.length && !filters.stages.includes(r.crm_stage_name ?? "")) return false;
      if (filters.categories.length && !filters.categories.includes(categoryKey(r))) return false;
      if (!meetingMatches(r, filters.meeting)) return false;
      if (filters.statuses.length && !filters.statuses.includes(r.last_meeting_status ?? "")) return false;
      return true;
    });
  }, [rows, filters]);

  const filterCount = countMeetingFilters(filters);
  const hasFilters = !!(search || filterCount || reachedIdx !== null || filter !== "all");
  function clearFilters() {
    setSearch("");
    setFilters(EMPTY_MEETING_FILTERS);
    setReachedIdx(null);
    setFilter("all");
  }
  const only = (list: string[], v: string) => list.length === 1 && list[0] === v;
  function jumpToList() {
    document.getElementById("lista-reunioes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function selectFunnel(i: number) {
    setReachedIdx((cur) => (cur === i ? null : i));
    if (reachedIdx !== i) jumpToList();
  }
  // Alterna um filtro de valor único (clique em card/linha): só ele ou nenhum.
  function toggleOnly(key: "campaignIds" | "stages" | "categories", value: string) {
    setReachedIdx(null);
    setFilters((f) => ({ ...f, [key]: only(f[key], value) ? [] : [value] }));
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
    const reach = base.map((r) => reachOf(r, historyCats.get(r.id)));
    const steps: FunnelStep[] = FUNNEL.map((f, i) => ({
      label: f.label,
      color: f.color,
      // o caminho do lead: quem chegou numa categoria à frente já passou por todas as anteriores
      reached: reach.filter((x) => x >= i).length,
      now: cats.filter((c) => c === i).length,
    }));
    return { steps, lost: cats.filter((c) => c === "lost").length, other: cats.filter((c) => c === "other").length };
  }, [base, historyCats]);

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

  // Busca da tabela e clique no funil: só a lista. Os contadores das abas refletem esse recorte.
  const listBase = useMemo(() => {
    const term = normalize(search);
    return base.filter((r) => {
      if (reachedIdx !== null && reachOf(r, historyCats.get(r.id)) < reachedIdx) return false;
      if (term) {
        const hay = normalize(
          [
            r.name, r.phone, r.email, one(r.matched_campaign)?.name, one(r.matched_ad)?.name,
            categoryLabel(r)?.label, r.crm_stage_name, r.crm_funnel_name, r.last_meeting_status, r.last_meeting_status ? meetingStatusText(r.last_meeting_status) : "",
          ].join(" ")
        );
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [base, search, reachedIdx, historyCats]);

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

  const campaignName = new Map(campaignOptions.map((o) => [o.value, o.label]));
  const categoryName = new Map(CATEGORY_FILTERS.map((o) => [o.value, o.label]));
  const chips: FilterChip[] = [
    ...filters.campaignIds.map((v) => ({ key: `c-${v}`, label: campaignName.get(v) ?? v, remove: () => setFilters((f) => ({ ...f, campaignIds: f.campaignIds.filter((x) => x !== v) })) })),
    ...filters.categories.map((v) => ({
      key: `k-${v}`,
      label: categoryName.get(v) ?? v,
      color: /^\d+$/.test(v) ? FUNNEL[Number(v)].color : undefined,
      remove: () => setFilters((f) => ({ ...f, categories: f.categories.filter((x) => x !== v) })),
    })),
    ...filters.stages.map((v) => ({ key: `s-${v}`, label: v, remove: () => setFilters((f) => ({ ...f, stages: f.stages.filter((x) => x !== v) })) })),
    ...(filters.meeting ? [{ key: "m", label: MEETING_FILTERS.find((m) => m.value === filters.meeting)?.label ?? filters.meeting, remove: () => setFilters((f) => ({ ...f, meeting: "" })) }] : []),
    ...filters.statuses.map((v) => ({ key: `t-${v}`, label: `Reunião: ${meetingStatusText(v)}`, remove: () => setFilters((f) => ({ ...f, statuses: f.statuses.filter((x) => x !== v) })) })),
  ];

  // Exporta a lista inteira (todas as páginas) com os mesmos filtros da tela.
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  function buildExport(): LeadExportData {
    const period = days === "all" ? "Todo o período" : days === "custom" ? `${custom.since} a ${custom.until}` : (PERIODS.find((p) => p.key === days)?.label ?? days);
    const tabLabel = { all: "Todos", crm: "No CRM", none: "Fora do CRM", meeting: "Com reunião" }[filter];
    const list = (label: string, vals: string[]): [string, string][] => (vals.length ? [[label, vals.join(", ")]] : []);
    const filtersInfo: [string, string][] = [
      ["Período", period],
      ["Aba", tabLabel],
      ...(search ? ([["Busca", search]] as [string, string][]) : []),
      ...list("Campanhas", filters.campaignIds.map((v) => campaignName.get(v) ?? v)),
      ...list("Categorias", filters.categories.map((v) => categoryName.get(v) ?? v)),
      ...list("Etapas", filters.stages),
      ...(filters.meeting ? ([["Reuniões", MEETING_FILTERS.find((m) => m.value === filters.meeting)?.label ?? filters.meeting]] as [string, string][]) : []),
      ...list("Status da reunião", filters.statuses.map((v) => meetingStatusText(v))),
      ...(reachedIdx !== null ? ([["Funil", `chegaram até ${FUNNEL[reachedIdx].label}`]] as [string, string][]) : []),
    ];
    return {
      filters: filtersInfo,
      columns: ["Lead", "Telefone", "CRM", "Campanha", "Categoria", "Etapa", "Reuniões", "No-show", "Reag.", "Última reunião", "Status"],
      rows: filtered.map((r) => [
        r.name || "—",
        r.phone ?? "",
        r.crm_lead_id ? "No CRM" : "Fora do CRM",
        one(r.matched_campaign)?.name ?? "—",
        categoryLabel(r)?.label ?? "—",
        r.crm_stage_name ?? "—",
        r.crm_lead_id ? r.meetings_count : "—",
        r.crm_lead_id ? r.meetings_no_show : "—",
        r.crm_lead_id ? r.meetings_rescheduled : "—",
        formatDate(r.last_meeting_at),
        r.last_meeting_status ? meetingStatusText(r.last_meeting_status) : "—",
      ]),
    };
  }
  async function runExport(kind: "pdf" | "xlsx") {
    setExporting(kind);
    try {
      const data = buildExport();
      await (kind === "pdf" ? exportLeadsPdf(data) : exportLeadsXlsx(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao exportar");
    } finally {
      setExporting(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const th = "sticky top-0 whitespace-nowrap bg-blue-900 px-4 py-3 text-left text-white";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs tabs={PERIODS} active={days} onChange={setDays} />
        {days === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <FilterDate
              label="De"
              value={custom.since}
              max={custom.until}
              onChange={(v) => v && setCustom((c) => ({ ...c, since: v }))}
            />
            <FilterDate
              label="até"
              value={custom.until}
              min={custom.since}
              max={todayBRT()}
              onChange={(v) => v && setCustom((c) => ({ ...c, until: v }))}
            />
          </div>
        )}
        <FilterButton count={filterCount} onClick={() => setFiltersOpen(true)} />
      </div>

      <FilterChips chips={chips} onClear={() => setFilters(EMPTY_MEETING_FILTERS)} className="!mb-0" />
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
            <FunnelChart steps={steps} activeIdx={reachedIdx ?? (filters.categories.length === 1 && /^\d+$/.test(filters.categories[0]) ? Number(filters.categories[0]) : null)} onSelect={selectFunnel} />
            <p className="mt-2 text-xs text-gray-500">
              O número em cada camada são os leads que chegaram até ali: quem está numa categoria à frente já passou por todas as anteriores (conta pela categoria atual, pelo histórico de etapas e pelas reuniões). Venda perdida conta até onde o lead tinha chegado e também aparece separada ao lado. Clique em uma camada para filtrar a lista abaixo.
            </p>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card
            role="button"
            tabIndex={0}
            onClick={() => toggleOnly("categories", "lost")}
            onKeyDown={(e) => e.key === "Enter" && toggleOnly("categories", "lost")}
            className={cn("cursor-pointer transition-shadow hover:shadow-md", only(filters.categories, "lost") && "ring-2 ring-[color:var(--color-danger)]")}
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
                <p className="text-[11px] font-bold uppercase text-gray-500">Sem fase</p>
                <p className="mt-1 text-2xl font-bold text-blue-900">{numberFormatter.format(other)}</p>
                <p className="mt-0.5 text-xs text-gray-500">Etapas sem fase no CRM (Formulário Nativo, Leads para Evento), fora do funil.</p>
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
                onClick={() => toggleOnly("stages", name)}
                className={cn("block w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-gray-050", only(filters.stages, name) && "bg-yellow-100/60 ring-1 ring-yellow-600/40")}
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
                    onClick={() => toggleOnly("campaignIds", c.id)}
                    className={cn("cursor-pointer border-b border-gray-100 text-blue-900 hover:bg-gray-050", only(filters.campaignIds, c.id) && "bg-yellow-100/60")}
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
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar lead, campanha, etapa, status…" className="w-full sm:w-72" />
            <FilterButton count={filterCount} onClick={() => setFiltersOpen(true)} />
            {(["xlsx", "pdf"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => runExport(k)}
                disabled={loading || filtered.length === 0 || exporting !== null}
                title={`Exportar ${filtered.length} leads em ${k.toUpperCase()} com os filtros aplicados`}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-gray-200 px-4 text-xs font-semibold text-blue-900 transition-colors hover:border-blue-900 disabled:opacity-40 sm:h-10"
              >
                {exporting === k ? <Download className="h-4 w-4 animate-pulse" /> : k === "pdf" ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
                {k === "pdf" ? "PDF" : "XLSX"}
              </button>
            ))}
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-blue-900 sm:h-10">
                <X className="h-3.5 w-3.5" /> Limpar tudo
              </button>
            )}
          </div>
        </CardHeader>
        <div className="px-5 pb-3">
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
          {reachedIdx !== null && (
            <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white">
              Funil: chegaram até {FUNNEL[reachedIdx].label}
              <button type="button" onClick={() => setReachedIdx(null)} aria-label="Remover filtro do funil">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
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
                  <td className="px-4 py-2.5">
                    {(() => {
                      const c = categoryLabel(r);
                      if (!c) return <span className="text-gray-300">—</span>;
                      return c.inferred ? (
                        <span className="italic text-gray-600" title="O CRM não enviou a fase deste lead; deduzida pela etapa">
                          {c.label}
                        </span>
                      ) : (
                        c.label
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5">{r.crm_stage_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">{r.crm_lead_id ? r.meetings_count : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">{r.crm_lead_id ? r.meetings_no_show : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">{r.crm_lead_id ? r.meetings_rescheduled : <span className="text-gray-300">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{formatDate(r.last_meeting_at)}</td>
                  <td className="px-4 py-2.5"><MeetingStatusBadge status={r.last_meeting_status} /></td>
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

      <RightDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} label="Filtros das reuniões">
        <MeetingsFilterPanel
          applied={filters}
          campaignOptions={campaignOptions}
          stageOptions={stageOptions.map((s) => ({ value: s, label: s }))}
          categoryOptions={CATEGORY_FILTERS.map((c) => ({ ...c, color: /^\d+$/.test(c.value) ? FUNNEL[Number(c.value)].color : c.value === "lost" ? "#c0392b" : undefined }))}
          meetingOptions={MEETING_FILTERS}
          statusOptions={statusOptions.map((s) => ({ value: s, label: meetingStatusText(s) }))}
          resultCount={base.length}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            setFilters(next);
            setReachedIdx(null);
            setFiltersOpen(false);
          }}
        />
      </RightDrawer>

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
