"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Check, CheckCircle2, Clock, Copy, ExternalLink, Image as ImageIcon, Layers,
  ListFilter, Plus, Star, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { StatCard } from "@/components/shared/StatCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterButton, FilterChips } from "@/components/ui/FilterBar";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { createCreative, deleteCreative, listCreatives, updateCreative } from "@/lib/services/creatives";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { cn, formatDate } from "@/lib/utils";
import { FRANCHISE_UNITS } from "@/lib/franchise-units";
import type { Creative, Profile } from "@/types/database";

const TEXT_FIELDS = ["name", "link"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

type SortField = "name" | "unit" | "deliverer" | "delivered_at";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortField; label: string; widthClass: string }[] = [
  { key: "name", label: "Nome", widthClass: "w-64" },
  { key: "unit", label: "Unidade", widthClass: "w-56" },
  { key: "deliverer", label: "Quem entregou", widthClass: "w-48" },
  { key: "delivered_at", label: "Entrega do arquivo", widthClass: "w-44" },
];

const PAGE_SIZE = 10;

const UNIT_OPTIONS = [
  { value: "Franqueadora", dotClass: "bg-blue-100 border-blue-600", color: "#2563eb" },
  { value: "Unidade", dotClass: "bg-yellow-100 border-yellow-600", color: "#e0a900" },
] as const;

interface Filters {
  name: string;
  unit: string;
  deliveredBy: string;
  link: string;
  dateFrom: string;
  dateTo: string;
  uploadedFrom: string;
  uploadedTo: string;
  topAd: string;
  uploadedStatus: string; // "" | "sim" | "nao"
}

const EMPTY_FILTERS: Filters = {
  name: "", unit: "", deliveredBy: "", link: "", dateFrom: "", dateTo: "", uploadedFrom: "", uploadedTo: "", topAd: "", uploadedStatus: "",
};

function countFilters(f: Filters, withName = true) {
  return (
    (withName && f.name.trim() ? 1 : 0) +
    (f.unit ? 1 : 0) + (f.deliveredBy ? 1 : 0) + (f.link.trim() ? 1 : 0) +
    (f.dateFrom || f.dateTo ? 1 : 0) + (f.uploadedFrom || f.uploadedTo ? 1 : 0) +
    (f.topAd ? 1 : 0) + (f.uploadedStatus ? 1 : 0)
  );
}

const dateInput =
  "h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-2.5 text-blue-900 outline-none focus:border-blue-900 focus:shadow-[var(--shadow-focus)] sm:h-10";
const cellInput =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-sm text-blue-900 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-yellow-500";

/* ------------------------------------------------------------------ */
/* Gaveta de filtros (rascunho -> "Aplicar")                           */
/* ------------------------------------------------------------------ */

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

function FilterPanel({
  applied,
  profiles,
  resultCount,
  onApply,
  onClose,
}: {
  applied: Filters;
  profiles: Profile[];
  resultCount: number;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
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
            {resultCount} {resultCount === 1 ? "criativo" : "criativos"} · {count > 0 ? `${count} ${count === 1 ? "selecionado" : "selecionados"}` : "sem filtros"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar filtros" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Group title="Situação do upload">
          <div className="flex flex-wrap gap-1.5">
            {([["", "Todos"], ["sim", "Já subido"], ["nao", "Pendente"]] as const).map(([v, label]) => (
              <Chip key={v || "all"} active={draft.uploadedStatus === v} color={v === "sim" ? "#2f8f5b" : v === "nao" ? "#e0a900" : undefined} onClick={() => set("uploadedStatus", v)}>
                {label}
              </Chip>
            ))}
          </div>
        </Group>

        <Group title="Unidade">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={draft.unit === ""} onClick={() => set("unit", "")}>Todas</Chip>
            {UNIT_OPTIONS.map((o) => (
              <Chip key={o.value} active={draft.unit === o.value} color={o.color} onClick={() => set("unit", draft.unit === o.value ? "" : o.value)}>
                {o.value}
              </Chip>
            ))}
          </div>
        </Group>

        <Group title="Top Ads">
          <div className="flex flex-wrap gap-1.5">
            {([["", "Todos"], ["sim", "Só Top Ads"], ["nao", "Fora do Top Ads"]] as const).map(([v, label]) => (
              <Chip key={v || "all"} active={draft.topAd === v} color={v === "sim" ? "#e0a900" : undefined} onClick={() => set("topAd", v)}>
                {label}
              </Chip>
            ))}
          </div>
        </Group>

        <Group title="Entregue por">
          <div className="max-h-52 space-y-0.5 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => set("deliveredBy", "")}
              aria-pressed={draft.deliveredBy === ""}
              className={cn("flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] font-semibold transition-colors", draft.deliveredBy === "" ? "bg-yellow-050 text-blue-900" : "text-gray-700 hover:bg-gray-050")}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] text-gray-500">★</span>
              Todos
              {draft.deliveredBy === "" && <Check className="ml-auto h-3.5 w-3.5 text-yellow-600" strokeWidth={3} />}
            </button>
            {profiles.map((p) => {
              const active = draft.deliveredBy === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set("deliveredBy", active ? "" : p.id)}
                  aria-pressed={active}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] font-semibold transition-colors", active ? "bg-yellow-050 text-blue-900" : "text-gray-700 hover:bg-gray-050")}
                >
                  <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{p.full_name}</span>
                  {active && <Check className="ast-pop h-3.5 w-3.5 text-yellow-600" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Data de entrega">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="Entrega de" value={draft.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} className={dateInput} />
            <input type="date" aria-label="Entrega até" value={draft.dateTo} onChange={(e) => set("dateTo", e.target.value)} className={dateInput} />
          </div>
        </Group>

        <Group title="Data de upload">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="Subido de" value={draft.uploadedFrom} onChange={(e) => set("uploadedFrom", e.target.value)} className={dateInput} />
            <input type="date" aria-label="Subido até" value={draft.uploadedTo} onChange={(e) => set("uploadedTo", e.target.value)} className={dateInput} />
          </div>
        </Group>

        <Group title="Link contém">
          <input
            value={draft.link}
            onChange={(e) => set("link", e.target.value)}
            placeholder="Trecho do link…"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-blue-900 outline-none placeholder:text-gray-400 focus:border-blue-900 focus:shadow-[var(--shadow-focus)] sm:h-10"
          />
        </Group>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white p-3">
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_FILTERS, name: applied.name })}
          disabled={count === 0}
          className="h-10 rounded-full px-4 font-display text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={() => onApply({ ...draft, name: applied.name })}
          className="h-10 flex-1 rounded-full bg-yellow-500 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.97]"
        >
          Aplicar filtros
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabela                                                              */
/* ------------------------------------------------------------------ */

export function CreativesTable({
  profiles,
  addSignal,
}: {
  profiles: Profile[];
  /** muda a cada clique em "Nova linha" do cabeçalho da página */
  addSignal?: number;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const editingCell = useRef<string | null>(null); // `${rowId}:${field}` currently being typed into
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function load() {
    try {
      const data = await listCreatives(supabase);
      setRows((prev) =>
        data.map((row) => {
          const local = prev.find((p) => p.id === row.id);
          if (!local) return row;
          const merged = { ...row };
          for (const field of TEXT_FIELDS) {
            if (editingCell.current === `${row.id}:${field}`) (merged as Creative)[field] = local[field];
          }
          return merged;
        })
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["creatives"], load);

  function handleTextChange(rowId: string, field: TextField, value: string) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));

    const key = `${rowId}:${field}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      updateCreative(supabase, rowId, { [field]: value }).catch(() => {});
    }, 500);
  }

  async function handleFieldSave(rowId: string, patch: Partial<Creative>) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
    await updateCreative(supabase, rowId, patch).catch(() => {});
  }

  async function addRow() {
    const minSortOrder = rows.reduce((min, r) => Math.min(min, r.sort_order), 0);
    const created = await createCreative(supabase, { sort_order: minSortOrder - 1 });
    setRows((prev) => [created, ...prev]);
    setPage(1);
  }

  // "Nova linha" fica no cabeçalho da página; ela avisa por este contador.
  const lastSignal = useRef(addSignal ?? 0);
  useEffect(() => {
    if (addSignal === undefined || addSignal === lastSignal.current) return;
    lastSignal.current = addSignal;
    void addRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal]);

  async function duplicateRow(row: Creative) {
    const created = await createCreative(supabase, {
      name: row.name,
      unit: row.unit,
      unit_name: row.unit_name,
      delivered_by: row.delivered_by,
      delivered_at: row.delivered_at,
      link: row.link,
      top_ad: row.top_ad,
      sort_order: row.sort_order - 1,
    });
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === row.id);
      return [...prev.slice(0, i + 1), created, ...prev.slice(i + 1)];
    });
  }

  async function removeRow(rowId: string) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    await deleteCreative(supabase, rowId).catch(() => {});
  }

  function toggleSort(field: SortField) {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortField(null);
    }
  }

  const activeCount = countFilters(filters);
  const hasActiveFilters = activeCount > 0;

  const visibleRows = useMemo(() => {
    let result = rows.filter((row) => {
      if (filters.name && !row.name.toLowerCase().includes(filters.name.trim().toLowerCase())) return false;
      if (filters.unit && row.unit !== filters.unit) return false;
      if (filters.link && !row.link.toLowerCase().includes(filters.link.trim().toLowerCase())) return false;
      if (filters.deliveredBy && row.delivered_by !== filters.deliveredBy) return false;
      if (filters.dateFrom && (!row.delivered_at || row.delivered_at < filters.dateFrom)) return false;
      if (filters.dateTo && (!row.delivered_at || row.delivered_at > filters.dateTo)) return false;
      if (filters.uploadedFrom && (!row.uploaded_at || row.uploaded_at < filters.uploadedFrom)) return false;
      if (filters.uploadedTo && (!row.uploaded_at || row.uploaded_at > filters.uploadedTo)) return false;
      if (filters.topAd && row.top_ad !== (filters.topAd === "sim")) return false;
      if (filters.uploadedStatus && !!row.uploaded_at !== (filters.uploadedStatus === "sim")) return false;
      return true;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        const av = sortField === "deliverer" ? a.deliverer?.full_name ?? "" : (a[sortField] ?? "");
        const bv = sortField === "deliverer" ? b.deliverer?.full_name ?? "" : (b[sortField] ?? "");
        const cmp = String(av).localeCompare(String(bv), "pt-BR");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, filters, sortField, sortDir]);

  const stats = useMemo(() => {
    const uploaded = rows.filter((r) => r.uploaded_at).length;
    return { total: rows.length, uploaded, pending: rows.length - uploaded, top: rows.filter((r) => r.top_ad).length };
  }, [rows]);

  // Filtering shows every match at once; pagination only applies to the unfiltered list.
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = hasActiveFilters
    ? visibleRows
    : visibleRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const deliverer = (id: string | null) => profiles.find((p) => p.id === id);

  // pílulas dos filtros aplicados
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (filters.name.trim()) chips.push({ key: "name", label: `“${filters.name.trim()}”`, remove: () => setFilters((f) => ({ ...f, name: "" })) });
  if (filters.unit) chips.push({ key: "unit", label: filters.unit, remove: () => setFilters((f) => ({ ...f, unit: "" })) });
  if (filters.uploadedStatus) chips.push({ key: "up", label: filters.uploadedStatus === "sim" ? "Já subido" : "Pendente de upload", remove: () => setFilters((f) => ({ ...f, uploadedStatus: "" })) });
  if (filters.topAd) chips.push({ key: "top", label: filters.topAd === "sim" ? "Top Ads" : "Fora do Top Ads", remove: () => setFilters((f) => ({ ...f, topAd: "" })) });
  if (filters.deliveredBy) chips.push({ key: "by", label: `Entregue por ${deliverer(filters.deliveredBy)?.full_name ?? "…"}`, remove: () => setFilters((f) => ({ ...f, deliveredBy: "" })) });
  if (filters.dateFrom || filters.dateTo)
    chips.push({ key: "dt", label: `Entrega ${filters.dateFrom ? formatDate(filters.dateFrom) : "…"} – ${filters.dateTo ? formatDate(filters.dateTo) : "…"}`, remove: () => setFilters((f) => ({ ...f, dateFrom: "", dateTo: "" })) });
  if (filters.uploadedFrom || filters.uploadedTo)
    chips.push({ key: "ut", label: `Upload ${filters.uploadedFrom ? formatDate(filters.uploadedFrom) : "…"} – ${filters.uploadedTo ? formatDate(filters.uploadedTo) : "…"}`, remove: () => setFilters((f) => ({ ...f, uploadedFrom: "", uploadedTo: "" })) });
  if (filters.link.trim()) chips.push({ key: "link", label: `Link: ${filters.link.trim()}`, remove: () => setFilters((f) => ({ ...f, link: "" })) });

  const unitSelect = (row: Creative) => (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Select
          className={cn("h-10", row.unit && "pl-8")}
          value={row.unit}
          style={{ fontSize: 16 }}
          onChange={(e) =>
            handleFieldSave(row.id, {
              unit: e.target.value,
              ...(e.target.value !== "Unidade" && { unit_name: "" }),
            })
          }
        >
          <option value="">Selecionar...</option>
          {UNIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.value}</option>
          ))}
        </Select>
        {row.unit && (
          <span className={cn("pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border", UNIT_OPTIONS.find((o) => o.value === row.unit)?.dotClass)} />
        )}
      </div>
      {row.unit === "Unidade" && (
        <Select className="h-10" value={row.unit_name} style={{ fontSize: 16 }} onChange={(e) => handleFieldSave(row.id, { unit_name: e.target.value })}>
          <option value="">Selecionar unidade...</option>
          {FRANCHISE_UNITS.map((u) => (
            <option key={u} value={u}>{u.replace("HELP MULTAS ", "")}</option>
          ))}
        </Select>
      )}
    </div>
  );

  const delivererSelect = (row: Creative) => (
    <Select className="h-10" value={row.delivered_by ?? ""} style={{ fontSize: 16 }} onChange={(e) => handleFieldSave(row.id, { delivered_by: e.target.value || null })}>
      <option value="">Selecionar...</option>
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>{p.full_name}</option>
      ))}
    </Select>
  );

  const linkField = (row: Creative) => (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={row.link}
        placeholder="https://..."
        onChange={(e) => handleTextChange(row.id, "link", e.target.value)}
        onFocus={() => (editingCell.current = `${row.id}:link`)}
        onBlur={() => (editingCell.current = null)}
        className={cn(cellInput, "border-transparent bg-transparent hover:border-gray-200 md:bg-transparent")}
        style={{ fontSize: 16 }}
      />
      {row.link && (
        <a href={row.link} target="_blank" rel="noopener noreferrer" title="Abrir link" aria-label="Abrir link" className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-blue-050 hover:text-blue-900">
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );

  const rowActions = (row: Creative) => (
    <div className="flex items-center justify-center gap-0.5">
      <button onClick={() => duplicateRow(row)} className="rounded-full p-2 text-gray-400 hover:bg-blue-050 hover:text-blue-900" aria-label="Duplicar linha" title="Duplicar linha">
        <Copy className="h-4 w-4" />
      </button>
      <button onClick={() => removeRow(row.id)} className="rounded-full p-2 text-gray-400 hover:bg-[color:var(--color-danger-bg)] hover:text-[color:var(--color-danger)]" aria-label="Remover linha" title="Remover linha">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const topAdToggle = (row: Creative) => (
    <button
      type="button"
      onClick={() => handleFieldSave(row.id, { top_ad: !row.top_ad })}
      aria-pressed={row.top_ad}
      title={row.top_ad ? "É Top Ads — clique para remover" : "Marcar como Top Ads"}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-xs font-bold transition-all active:scale-95",
        row.top_ad ? "border-yellow-500 bg-yellow-500 text-blue-900 shadow-sm" : "border-gray-200 text-gray-500 hover:border-yellow-500 hover:text-blue-900"
      )}
    >
      <Star className={cn("h-4 w-4", row.top_ad && "fill-current")} />
      {row.top_ad ? "Top Ads" : "Não"}
    </button>
  );

  return (
    <div>
      {/* Resumo */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ImageIcon} label="Criativos" value={stats.total} color="#375367" index={0} />
        <StatCard
          icon={CheckCircle2}
          label="Já subidos"
          value={stats.uploaded}
          color="#2f8f5b"
          index={1}
          active={filters.uploadedStatus === "sim"}
          onClick={() => setFilters((f) => ({ ...f, uploadedStatus: f.uploadedStatus === "sim" ? "" : "sim" }))}
        />
        <StatCard
          icon={Clock}
          label="Pendentes de upload"
          value={stats.pending}
          color="#e0a900"
          index={2}
          active={filters.uploadedStatus === "nao"}
          onClick={() => setFilters((f) => ({ ...f, uploadedStatus: f.uploadedStatus === "nao" ? "" : "nao" }))}
        />
        <StatCard
          icon={Star}
          label="Top Ads"
          value={stats.top}
          color="#8b5cf6"
          index={3}
          active={filters.topAd === "sim"}
          onClick={() => setFilters((f) => ({ ...f, topAd: f.topAd === "sim" ? "" : "sim" }))}
        />
      </div>

      {/* Barra: busca + filtros + nova linha */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={filters.name} onChange={(name) => setFilters((f) => ({ ...f, name }))} placeholder="Buscar criativo pelo nome…" />
        <FilterButton count={countFilters(filters, false)} onClick={() => setFiltersOpen(true)} />
        <span className="ml-auto hidden items-center gap-3 text-xs text-gray-500 lg:flex">
          {UNIT_OPTIONS.map((o) => (
            <span key={o.value} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full border", o.dotClass)} /> {o.value}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border" style={{ background: "var(--color-success-bg)", borderColor: "var(--color-success)" }} /> Já subido
          </span>
        </span>
      </div>

      <FilterChips chips={chips} onClear={() => setFilters(EMPTY_FILTERS)} />

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Carregando criativos">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="ast-skeleton h-14 rounded-2xl" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="ast-fade-up flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-200 bg-gray-050/60 px-6 py-14 text-center">
          <Layers className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">{rows.length === 0 ? "Nenhum criativo cadastrado ainda." : "Nenhum resultado para os filtros aplicados."}</p>
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
          {/* Celular: cartões editáveis */}
          <ul className="space-y-3 md:hidden">
            {pageRows.map((row, i) => (
              <li
                key={row.id}
                style={{ animationDelay: `${Math.min(i, 8) * 35}ms`, borderLeftColor: row.uploaded_at ? "var(--color-success)" : UNIT_OPTIONS.find((o) => o.value === row.unit)?.color ?? "#d8e0e4" }}
                className={cn("kb-card-in space-y-3 rounded-2xl border border-l-4 border-gray-200 p-3.5 shadow-[var(--shadow-sm)]", row.uploaded_at ? "bg-[color:var(--color-success-bg)]" : "bg-white")}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.name}
                    placeholder="Nome do criativo"
                    onChange={(e) => handleTextChange(row.id, "name", e.target.value)}
                    onFocus={() => (editingCell.current = `${row.id}:name`)}
                    onBlur={() => (editingCell.current = null)}
                    className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-1.5 py-1 font-display text-sm font-bold text-blue-900 outline-none placeholder:font-normal placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-yellow-500"
                    style={{ fontSize: 16 }}
                  />
                  {rowActions(row)}
                </div>
                {unitSelect(row)}
                {delivererSelect(row)}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase text-gray-500">Entrega</span>
                    <input type="date" value={row.delivered_at ?? ""} onChange={(e) => handleFieldSave(row.id, { delivered_at: e.target.value || null })} className={cellInput} style={{ fontSize: 16 }} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase text-gray-500">Subido em</span>
                    <input type="date" value={row.uploaded_at ?? ""} onChange={(e) => handleFieldSave(row.id, { uploaded_at: e.target.value || null })} className={cellInput} style={{ fontSize: 16 }} />
                  </label>
                </div>
                {linkField(row)}
                <div className="flex items-center justify-between">
                  {topAdToggle(row)}
                  {row.uploaded_at && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-[color:var(--color-success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Já subido
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela editável */}
          <div className="hidden max-h-[70vh] overflow-auto rounded-3xl border border-gray-200 bg-white shadow-[var(--shadow-sm)] md:block">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-white">
                  {COLUMNS.map((col) => (
                    <th key={col.key} className={cn("sticky top-0 z-20 bg-blue-900 px-3 py-3", col.widthClass)}>
                      <button onClick={() => toggleSort(col.key)} className={cn("flex items-center gap-1 uppercase transition-colors hover:text-yellow-400", sortField === col.key && "text-yellow-400")}>
                        {col.label}
                        {sortField === col.key ? (sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
                      </button>
                    </th>
                  ))}
                  <th className="sticky top-0 z-20 w-56 bg-blue-900 px-3 py-3">Link de criativos</th>
                  <th className="sticky top-0 z-20 w-44 bg-blue-900 px-3 py-3">Subido em</th>
                  <th className="sticky right-24 top-0 z-30 w-28 border-l border-white/10 bg-blue-900 px-2 py-3">Top Ads</th>
                  <th className="sticky right-0 top-0 z-30 w-24 border-l border-white/10 bg-blue-900 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => {
                  const bg = row.uploaded_at ? "bg-[color:var(--color-success-bg)]" : "bg-white";
                  return (
                    <tr
                      key={row.id}
                      style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
                      className={cn("kb-card-in group border-b border-gray-100 transition-colors last:border-0", row.uploaded_at ? "bg-[color:var(--color-success-bg)]" : "hover:bg-yellow-050/60")}
                    >
                      <td className="border-l-4 px-2 py-1.5" style={{ borderLeftColor: row.uploaded_at ? "var(--color-success)" : UNIT_OPTIONS.find((o) => o.value === row.unit)?.color ?? "transparent" }}>
                        <input
                          type="text"
                          value={row.name}
                          placeholder="Nome do criativo"
                          onChange={(e) => handleTextChange(row.id, "name", e.target.value)}
                          onFocus={() => (editingCell.current = `${row.id}:name`)}
                          onBlur={() => (editingCell.current = null)}
                          className="h-10 w-full rounded-xl border border-transparent bg-transparent px-2.5 text-sm font-semibold text-blue-900 placeholder:font-normal placeholder:text-gray-400 hover:border-gray-200 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                      </td>
                      <td className="px-2 py-1.5">{unitSelect(row)}</td>
                      <td className="px-2 py-1.5">{delivererSelect(row)}</td>
                      <td className="px-2 py-1.5">
                        <input type="date" value={row.delivered_at ?? ""} onChange={(e) => handleFieldSave(row.id, { delivered_at: e.target.value || null })} className={cellInput} />
                      </td>
                      <td className="px-2 py-1.5">{linkField(row)}</td>
                      <td className="px-2 py-1.5">
                        <input type="date" value={row.uploaded_at ?? ""} onChange={(e) => handleFieldSave(row.id, { uploaded_at: e.target.value || null })} className={cellInput} />
                      </td>
                      <td className={cn("sticky right-24 z-10 border-l border-gray-200 px-2 py-1.5", bg)}>{topAdToggle(row)}</td>
                      <td className={cn("sticky right-0 z-10 border-l border-gray-200 px-2 py-1.5", bg)}>{rowActions(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-gray-400">Tudo é editável direto na linha e salvo automaticamente.</p>
        </>
      )}

      {!hasActiveFilters && !loading && (
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={visibleRows.length} onPageChange={setPage} />
      )}

      <RightDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} label="Filtros dos criativos">
        <FilterPanel
          applied={filters}
          profiles={profiles}
          resultCount={visibleRows.length}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            setFilters(next);
            setPage(1);
            setFiltersOpen(false);
          }}
        />
      </RightDrawer>
    </div>
  );
}
