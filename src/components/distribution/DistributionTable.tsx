"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Layers, ListFilter, Palette, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterButton, FilterChips } from "@/components/ui/FilterBar";
import { createClient } from "@/lib/supabase/client";
import {
  createDistributionPost, deleteDistributionPost, listDistributionPosts, updateDistributionPost,
} from "@/lib/services/distribution";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { cn, formatDate } from "@/lib/utils";
import { FRANCHISE_UNITS } from "@/lib/franchise-units";
import type { DistributionPost } from "@/types/database";

const PAGE_SIZE = 10;

interface Opt { value: string; label: string; color: string }

const ACTIVE_OPTIONS: Opt[] = [
  { value: "sim", label: "Sim", color: "#2f8f5b" },
  { value: "nao", label: "Não", color: "#8a99a3" },
];
const UNIT_OPTIONS: Opt[] = [
  { value: "Franqueadora", label: "Franqueadora", color: "#2563eb" },
  { value: "Unidade", label: "Unidade", color: "#e0a900" },
];
const CATEGORY_OPTIONS: Opt[] = [
  { value: "bom", label: "Bom", color: "#2f8f5b" },
  { value: "medio", label: "Médio", color: "#e0a900" },
  { value: "ruim", label: "Ruim", color: "#d64545" },
];
const FORMAT_OPTIONS: Opt[] = [
  { value: "carrossel", label: "Carrossel", color: "#8b5cf6" },
  { value: "estatico", label: "Estático", color: "#0ea5e9" },
  { value: "reels", label: "Reels", color: "#ec4899" },
  { value: "foto", label: "Foto", color: "#14b8a6" },
  { value: "noticia", label: "Notícia", color: "#f97316" },
];
const WHAT_OPTIONS: Opt[] = [
  { value: "frase", label: "Frase", color: "#8b5cf6" },
  { value: "conteudo", label: "Conteúdo", color: "#2563eb" },
  { value: "historia", label: "História", color: "#ec4899" },
  { value: "organico", label: "Orgânico", color: "#2f8f5b" },
  { value: "gancho", label: "Gancho", color: "#f97316" },
  { value: "motivacional", label: "Motivacional", color: "#e0a900" },
  { value: "caixinha pergunta", label: "Caixinha pergunta", color: "#14b8a6" },
  { value: "depoimento", label: "Depoimento", color: "#d64545" },
];
const PILLAR_OPTIONS: Opt[] = [
  { value: "suspensao", label: "Suspensão", color: "#d64545" },
  { value: "ppd", label: "PPD", color: "#2563eb" },
  { value: "embriaguez", label: "Embriaguez", color: "#8b5cf6" },
  { value: "em alta", label: "Em alta", color: "#f97316" },
  { value: "outro", label: "Outro", color: "#8a99a3" },
  { value: "deferido", label: "Deferido", color: "#2f8f5b" },
  { value: "evento interno", label: "Evento interno", color: "#14b8a6" },
  { value: "infrações", label: "Infrações", color: "#e0a900" },
  { value: "eventos", label: "Eventos", color: "#ec4899" },
  { value: "franqueado", label: "Franqueado", color: "#0ea5e9" },
  { value: "entrevista", label: "Entrevista", color: "#7c3aed" },
  { value: "venda de franquia", label: "Venda de franquia", color: "#16a34a" },
];

const ROW_COLORS = ["#fef3c7", "#dcfce7", "#dbeafe", "#fce7f3", "#ede9fe", "#ffedd5", "#fee2e2", "#ccfbf1"];

const HEADERS: { label: string; width: string }[] = [
  { label: "Ativo", width: "w-28" },
  { label: "Unidade", width: "w-52" },
  { label: "Início do impulsionamento", width: "w-44" },
  { label: "Final do impulsionamento", width: "w-44" },
  { label: "Nomenclatura", width: "w-64" },
  { label: "Link publicado", width: "w-64" },
  { label: "Investimento", width: "w-36" },
  { label: "Duração do teste (dias)", width: "w-32" },
  { label: "Valor diário", width: "w-32" },
  { label: "Categoria do post (pós teste)", width: "w-44" },
  { label: "Seguidores (antes)", width: "w-32" },
  { label: "Seguidores (fim)", width: "w-32" },
  { label: "Seguidores pagos", width: "w-32" },
  { label: "Custo por seguidor (meta R$ 0,50)", width: "w-40" },
  { label: "Formato", width: "w-44" },
  { label: "O que é?", width: "w-52" },
  { label: "Pilar", width: "w-52" },
];

const cellInput =
  "h-10 w-full rounded-xl border border-transparent bg-transparent px-2.5 text-sm text-blue-900 outline-none transition-shadow hover:border-gray-200 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-yellow-500";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function parseDecimal(raw: string): number | null {
  const s = raw.replace(/[^\d,.-]/g, "");
  if (!s) return null;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Texto livre: edita localmente e grava ao sair do campo / após uma pausa. */
function TextCell({ value, placeholder, onSave, className }: { value: string; placeholder?: string; onSave: (v: string) => void; className?: string }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onSave(v), 600);
      }}
      onBlur={() => {
        focused.current = false;
        if (timer.current) clearTimeout(timer.current);
        if (draft !== value) onSave(draft);
      }}
      className={cn(cellInput, className)}
      style={{ fontSize: 16 }}
    />
  );
}

/** Número: moeda (R$ 1.234,56) ou inteiro. Mostra formatado fora de foco. */
function NumberCell({ value, kind, onSave }: { value: number | null; kind: "money" | "int"; onSave: (v: number | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null); // null = não está editando
  const shown = draft ?? (value == null ? "" : kind === "money" ? brl.format(value) : String(value));

  function commit() {
    if (draft == null) return;
    let n = parseDecimal(draft);
    if (n != null && kind === "int") n = Math.round(n);
    setDraft(null);
    if (n !== value) onSave(n);
  }

  return (
    <input
      type="text"
      inputMode={kind === "money" ? "decimal" : "numeric"}
      value={shown}
      placeholder={kind === "money" ? "R$ 0,00" : "0"}
      onFocus={() => setDraft(value == null ? "" : kind === "money" ? String(value).replace(".", ",") : String(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn(cellInput, "text-right tabular-nums")}
      style={{ fontSize: 16 }}
    />
  );
}

function ColorSelect({ value, options, onChange }: { value: string; options: Opt[]; onChange: (v: string) => void }) {
  const color = options.find((o) => o.value === value)?.color;
  return (
    <Select
      className="h-10 font-semibold"
      value={value}
      style={{ fontSize: 16, ...(color && { backgroundColor: `${color}26`, borderColor: `${color}80` }) }}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Selecionar...</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </Select>
  );
}

/* ------------------------------------------------------------------ */
/* Filtros                                                             */
/* ------------------------------------------------------------------ */

interface Filters {
  search: string;
  active: string; // "" | "sim" | "nao"
  unit: string[];
  category: string[];
  format: string[];
  whatIs: string[];
  pillar: string[];
  startFrom: string;
  startTo: string;
  cost: string; // "" | "meta" (<= 0,50) | "acima" | "sem"
}

const EMPTY_FILTERS: Filters = {
  search: "", active: "", unit: [], category: [], format: [], whatIs: [], pillar: [], startFrom: "", startTo: "", cost: "",
};

const COST_GOAL = 0.5;

function countFilters(f: Filters, withSearch = true) {
  return (
    (withSearch && f.search.trim() ? 1 : 0) + (f.active ? 1 : 0) + (f.unit.length ? 1 : 0) + (f.category.length ? 1 : 0) +
    (f.format.length ? 1 : 0) + (f.whatIs.length ? 1 : 0) + (f.pillar.length ? 1 : 0) +
    (f.startFrom || f.startTo ? 1 : 0) + (f.cost ? 1 : 0)
  );
}

const dateInput =
  "h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-2.5 text-blue-900 outline-none focus:border-blue-900 focus:shadow-[var(--shadow-focus)] sm:h-10";

function Chip({ active, color, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all active:scale-95",
        active ? "border-transparent text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      )}
      style={active ? { backgroundColor: color ?? "#243746" } : undefined}
    >
      {active && <Check className="ast-pop h-3 w-3" strokeWidth={3} />}
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 px-4 py-4 first:border-t-0">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
      {children}
    </div>
  );
}

function MultiChips({ options, selected, onChange }: { options: Opt[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip active={selected.length === 0} onClick={() => onChange([])}>Todos</Chip>
      {options.map((o) => (
        <Chip
          key={o.value}
          active={selected.includes(o.value)}
          color={o.color}
          onClick={() => onChange(selected.includes(o.value) ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

function FilterPanel({ applied, resultCount, onApply, onClose }: { applied: Filters; resultCount: number; onApply: (f: Filters) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Filters>(applied);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const count = countFilters(draft, false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-900 text-yellow-500">
          <ListFilter className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-display text-sm font-bold text-blue-900">Filtros</p>
          <p className="text-[11px] text-gray-500">
            {resultCount} {resultCount === 1 ? "post" : "posts"} · {count > 0 ? `${count} ${count === 1 ? "selecionado" : "selecionados"}` : "sem filtros"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar filtros" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Group title="Ativo">
          <div className="flex flex-wrap gap-1.5">
            {([["", "Todos"], ["sim", "Ativos"], ["nao", "Inativos"]] as const).map(([v, label]) => (
              <Chip key={v || "all"} active={draft.active === v} color={v === "sim" ? "#2f8f5b" : v === "nao" ? "#8a99a3" : undefined} onClick={() => set("active", v)}>
                {label}
              </Chip>
            ))}
          </div>
        </Group>
        <Group title="Unidade"><MultiChips options={UNIT_OPTIONS} selected={draft.unit} onChange={(v) => set("unit", v)} /></Group>
        <Group title="Categoria do post"><MultiChips options={CATEGORY_OPTIONS} selected={draft.category} onChange={(v) => set("category", v)} /></Group>
        <Group title="Formato"><MultiChips options={FORMAT_OPTIONS} selected={draft.format} onChange={(v) => set("format", v)} /></Group>
        <Group title="O que é?"><MultiChips options={WHAT_OPTIONS} selected={draft.whatIs} onChange={(v) => set("whatIs", v)} /></Group>
        <Group title="Pilar"><MultiChips options={PILLAR_OPTIONS} selected={draft.pillar} onChange={(v) => set("pillar", v)} /></Group>
        <Group title="Início do impulsionamento">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="Início de" value={draft.startFrom} onChange={(e) => set("startFrom", e.target.value)} className={dateInput} />
            <input type="date" aria-label="Início até" value={draft.startTo} onChange={(e) => set("startTo", e.target.value)} className={dateInput} />
          </div>
        </Group>
        <Group title="Custo por seguidor (meta R$ 0,50)">
          <div className="flex flex-wrap gap-1.5">
            {([["", "Todos"], ["meta", "Dentro da meta"], ["acima", "Acima da meta"], ["sem", "Sem custo"]] as const).map(([v, label]) => (
              <Chip key={v || "all"} active={draft.cost === v} color={v === "meta" ? "#2f8f5b" : v === "acima" ? "#d64545" : undefined} onClick={() => set("cost", v)}>
                {label}
              </Chip>
            ))}
          </div>
        </Group>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white p-3">
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_FILTERS, search: applied.search })}
          disabled={count === 0}
          className="h-10 rounded-full px-4 font-display text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={() => onApply({ ...draft, search: applied.search })}
          className="h-10 flex-1 rounded-full bg-yellow-500 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.97]"
        >
          Aplicar filtros
        </button>
      </div>
    </div>
  );
}

export function DistributionTable({ addSignal }: { addSignal?: number }) {
  const supabase = createClient();
  const [rows, setRows] = useState<DistributionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [palette, setPalette] = useState<{ id: string; x: number; y: number } | null>(null);

  async function load() {
    try {
      setRows(await listDistributionPosts(supabase));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["distribution_posts"], load);

  async function save(id: string, patch: Partial<DistributionPost>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await updateDistributionPost(supabase, id, patch).catch(() => {});
  }

  async function addRow() {
    const min = rows.reduce((m, r) => Math.min(m, r.sort_order), 0);
    const created = await createDistributionPost(supabase, { sort_order: min - 1 });
    setRows((prev) => [created, ...prev]); // novas linhas sempre aparecem no topo
    setPage(1);
  }

  const lastSignal = useRef(addSignal ?? 0);
  useEffect(() => {
    if (addSignal === undefined || addSignal === lastSignal.current) return;
    lastSignal.current = addSignal;
    void addRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal]);

  async function duplicateRow(row: DistributionPost) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, created_by, ...copy } = row;
    const created = await createDistributionPost(supabase, { ...copy, sort_order: row.sort_order - 1 });
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === row.id);
      return [...prev.slice(0, i + 1), created, ...prev.slice(i + 1)];
    });
  }

  async function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await deleteDistributionPost(supabase, id).catch(() => {});
  }

  const visibleRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.nomenclature} ${r.post_link} ${r.unit_name}`.toLowerCase().includes(q)) return false;
      if (filters.active && r.active !== (filters.active === "sim")) return false;
      if (filters.unit.length && !filters.unit.includes(r.unit)) return false;
      if (filters.category.length && !filters.category.includes(r.post_category)) return false;
      if (filters.format.length && !filters.format.includes(r.format)) return false;
      if (filters.whatIs.length && !filters.whatIs.includes(r.what_is)) return false;
      if (filters.pillar.length && !filters.pillar.includes(r.pillar)) return false;
      if (filters.startFrom && (!r.boost_start || r.boost_start < filters.startFrom)) return false;
      if (filters.startTo && (!r.boost_start || r.boost_start > filters.startTo)) return false;
      if (filters.cost === "sem" && r.cost_per_follower != null) return false;
      if (filters.cost === "meta" && (r.cost_per_follower == null || r.cost_per_follower > COST_GOAL)) return false;
      if (filters.cost === "acima" && (r.cost_per_follower == null || r.cost_per_follower <= COST_GOAL)) return false;
      return true;
    });
  }, [rows, filters]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => visibleRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [visibleRows, currentPage]);

  const labelOf = (opts: Opt[], v: string) => opts.find((o) => o.value === v)?.label ?? v;
  const drop = (patch: Partial<Filters>) => () => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (filters.search.trim()) chips.push({ key: "q", label: `“${filters.search.trim()}”`, remove: drop({ search: "" }) });
  if (filters.active) chips.push({ key: "act", label: filters.active === "sim" ? "Ativos" : "Inativos", remove: drop({ active: "" }) });
  if (filters.unit.length) chips.push({ key: "unit", label: filters.unit.join(", "), remove: drop({ unit: [] }) });
  if (filters.category.length) chips.push({ key: "cat", label: `Categoria: ${filters.category.map((v) => labelOf(CATEGORY_OPTIONS, v)).join(", ")}`, remove: drop({ category: [] }) });
  if (filters.format.length) chips.push({ key: "fmt", label: `Formato: ${filters.format.map((v) => labelOf(FORMAT_OPTIONS, v)).join(", ")}`, remove: drop({ format: [] }) });
  if (filters.whatIs.length) chips.push({ key: "what", label: `O que é: ${filters.whatIs.map((v) => labelOf(WHAT_OPTIONS, v)).join(", ")}`, remove: drop({ whatIs: [] }) });
  if (filters.pillar.length) chips.push({ key: "pil", label: `Pilar: ${filters.pillar.map((v) => labelOf(PILLAR_OPTIONS, v)).join(", ")}`, remove: drop({ pillar: [] }) });
  if (filters.startFrom || filters.startTo)
    chips.push({ key: "dt", label: `Início ${filters.startFrom ? formatDate(filters.startFrom) : "…"} – ${filters.startTo ? formatDate(filters.startTo) : "…"}`, remove: drop({ startFrom: "", startTo: "" }) });
  if (filters.cost) chips.push({ key: "cost", label: { meta: "Custo dentro da meta", acima: "Custo acima da meta", sem: "Sem custo" }[filters.cost] ?? "", remove: drop({ cost: "" }) });

  const paletteRow = palette ? rows.find((r) => r.id === palette.id) : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.search}
          onChange={(search) => {
            setFilters((f) => ({ ...f, search }));
            setPage(1);
          }}
          placeholder="Buscar por nomenclatura, link ou unidade…"
        />
        <FilterButton count={countFilters(filters, false)} onClick={() => setFiltersOpen(true)} />
      </div>

      <FilterChips
        chips={chips}
        onClear={() => {
          setFilters(EMPTY_FILTERS);
          setPage(1);
        }}
      />

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Carregando distribuição">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="ast-skeleton h-14 rounded-2xl" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="ast-fade-up flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-200 bg-gray-050/60 px-6 py-14 text-center">
          <Layers className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">{rows.length === 0 ? "Nenhum post cadastrado ainda." : "Nenhum resultado para os filtros aplicados."}</p>
          {rows.length === 0 ? (
            <Button size="sm" onClick={addRow} className="gap-1.5">
              <Plus className="h-4 w-4" /> Cadastrar o primeiro
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="max-h-[70vh] overflow-auto rounded-3xl border border-gray-200 bg-white shadow-[var(--shadow-sm)]">
            <table className="w-full min-w-[2800px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-white">
                  {HEADERS.map((h) => (
                    <th key={h.label} className={cn("sticky top-0 z-20 bg-blue-900 px-3 py-3", h.width)}>{h.label}</th>
                  ))}
                  <th className="sticky right-0 top-0 z-30 w-32 border-l border-white/10 bg-blue-900 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => {
                  // linhas alternadas (branco / cinza claro); a cor escolhida pinta a linha inteira
                  const bg = row.row_color || (i % 2 === 0 ? "#ffffff" : "#f4f6f7");
                  const unitColor = UNIT_OPTIONS.find((o) => o.value === row.unit)?.color;
                  return (
                    <tr key={row.id} style={{ backgroundColor: bg }} className="border-b border-gray-100 last:border-0">
                      <td className="border-l-4 px-2 py-1.5" style={{ borderLeftColor: row.active ? "var(--color-success)" : "#cbd5da" }}>
                        <ColorSelect value={row.active ? "sim" : "nao"} options={ACTIVE_OPTIONS} onChange={(v) => save(row.id, { active: v === "sim" })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col gap-1.5">
                          <ColorSelect
                            value={row.unit}
                            options={UNIT_OPTIONS}
                            onChange={(v) => save(row.id, { unit: v, ...(v !== "Unidade" && { unit_name: "" }) })}
                          />
                          {row.unit === "Unidade" && (
                            <Select
                              className="h-10"
                              value={row.unit_name}
                              style={{ fontSize: 16, ...(unitColor && { backgroundColor: `${unitColor}26`, borderColor: `${unitColor}80` }) }}
                              onChange={(e) => save(row.id, { unit_name: e.target.value })}
                            >
                              <option value="">Selecionar unidade...</option>
                              {FRANCHISE_UNITS.map((u) => (
                                <option key={u} value={u}>{u.replace("HELP MULTAS ", "")}</option>
                              ))}
                            </Select>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="date" value={row.boost_start ?? ""} onChange={(e) => save(row.id, { boost_start: e.target.value || null })} className={cellInput} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="date" value={row.boost_end ?? ""} onChange={(e) => save(row.id, { boost_end: e.target.value || null })} className={cellInput} />
                      </td>
                      <td className="px-2 py-1.5">
                        <TextCell value={row.nomenclature} placeholder="Nomenclatura" onSave={(v) => save(row.id, { nomenclature: v })} className="font-semibold" />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <TextCell value={row.post_link} placeholder="https://..." onSave={(v) => save(row.id, { post_link: v })} />
                          {row.post_link.trim() && (
                            <a
                              href={/^https?:\/\//i.test(row.post_link.trim()) ? row.post_link.trim() : `https://${row.post_link.trim()}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir post"
                              aria-label="Abrir post"
                              className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-blue-050 hover:text-blue-900"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5"><NumberCell kind="money" value={row.investment} onSave={(v) => save(row.id, { investment: v })} /></td>
                      <td className="px-2 py-1.5"><NumberCell kind="int" value={row.test_days} onSave={(v) => save(row.id, { test_days: v })} /></td>
                      <td className="px-2 py-1.5"><NumberCell kind="money" value={row.daily_value} onSave={(v) => save(row.id, { daily_value: v })} /></td>
                      <td className="px-2 py-1.5">
                        <ColorSelect value={row.post_category} options={CATEGORY_OPTIONS} onChange={(v) => save(row.id, { post_category: v as DistributionPost["post_category"] })} />
                      </td>
                      <td className="px-2 py-1.5"><NumberCell kind="int" value={row.followers_before} onSave={(v) => save(row.id, { followers_before: v })} /></td>
                      <td className="px-2 py-1.5"><NumberCell kind="int" value={row.followers_after} onSave={(v) => save(row.id, { followers_after: v })} /></td>
                      <td className="px-2 py-1.5"><NumberCell kind="int" value={row.paid_followers} onSave={(v) => save(row.id, { paid_followers: v })} /></td>
                      <td className="px-2 py-1.5"><NumberCell kind="money" value={row.cost_per_follower} onSave={(v) => save(row.id, { cost_per_follower: v })} /></td>
                      <td className="px-2 py-1.5"><ColorSelect value={row.format} options={FORMAT_OPTIONS} onChange={(v) => save(row.id, { format: v })} /></td>
                      <td className="px-2 py-1.5"><ColorSelect value={row.what_is} options={WHAT_OPTIONS} onChange={(v) => save(row.id, { what_is: v })} /></td>
                      <td className="px-2 py-1.5"><ColorSelect value={row.pillar} options={PILLAR_OPTIONS} onChange={(v) => save(row.id, { pillar: v })} /></td>
                      <td className="sticky right-0 z-10 border-l border-gray-200 px-2 py-1.5" style={{ backgroundColor: bg }}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setPalette((p) => (p?.id === row.id ? null : { id: row.id, x: Math.max(8, r.right - 232), y: r.bottom + 6 }));
                            }}
                            className="rounded-full p-2 text-gray-400 hover:bg-blue-050 hover:text-blue-900"
                            aria-label="Pintar linha"
                            title="Pintar linha"
                          >
                            <Palette className="h-4 w-4" />
                          </button>
                          <button onClick={() => duplicateRow(row)} className="rounded-full p-2 text-gray-400 hover:bg-blue-050 hover:text-blue-900" aria-label="Duplicar linha" title="Duplicar linha">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button onClick={() => removeRow(row.id)} className="rounded-full p-2 text-gray-400 hover:bg-[color:var(--color-danger-bg)] hover:text-[color:var(--color-danger)]" aria-label="Remover linha" title="Remover linha">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-gray-400">Tudo é editável direto na linha e salvo automaticamente. Use a paleta para pintar a linha inteira.</p>
        </>
      )}

      <Pagination page={currentPage} pageSize={PAGE_SIZE} total={visibleRows.length} onPageChange={setPage} />

      <RightDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} label="Filtros da distribuição">
        <FilterPanel
          applied={filters}
          resultCount={visibleRows.length}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            setFilters(next);
            setPage(1);
            setFiltersOpen(false);
          }}
        />
      </RightDrawer>

      {palette && paletteRow && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPalette(null)} />
          <div
            className="fixed z-50 flex w-[232px] flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg"
            style={{ left: palette.x, top: palette.y }}
          >
            {ROW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Pintar com ${c}`}
                onClick={() => {
                  save(paletteRow.id, { row_color: c });
                  setPalette(null);
                }}
                className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-110", paletteRow.row_color === c ? "border-blue-900" : "border-white shadow-[0_0_0_1px_#d8e0e4]")}
                style={{ backgroundColor: c }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                save(paletteRow.id, { row_color: "" });
                setPalette(null);
              }}
              className="flex h-7 items-center gap-1 rounded-full border border-gray-200 px-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              <X className="h-3 w-3" /> Sem cor
            </button>
          </div>
        </>
      )}
    </div>
  );
}
