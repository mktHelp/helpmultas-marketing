"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { createClient } from "@/lib/supabase/client";
import { listCreatives } from "@/lib/services/creatives";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { cn } from "@/lib/utils";
import type { Creative } from "@/types/database";

// Read-only view of the "Criativos" sheet for the expansion team: only the
// franchisor's own ads (unit = "Franqueadora"), never the per-unit ones.
const EXPANSION_UNIT = "Franqueadora";
const PAGE_SIZE = 10;

type SortField = "name" | "deliverer" | "delivered_at" | "uploaded_at";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortField | null; label: string; widthClass: string }[] = [
  { key: "name", label: "Nome", widthClass: "min-w-64" },
  { key: "deliverer", label: "Entregue por", widthClass: "w-48" },
  { key: "delivered_at", label: "Data de entrega", widthClass: "w-40" },
  { key: null, label: "Link de criativos", widthClass: "w-64" },
  { key: "uploaded_at", label: "Subido na data de", widthClass: "w-40" },
  { key: null, label: "Top Ads", widthClass: "w-28" },
];

const STICKY_TH = "sticky top-0 z-20 bg-gray-050 shadow-[inset_0_-1px_0_var(--gray-200)]";

const EMPTY_FILTERS = {
  name: "",
  deliveredBy: "",
  dateFrom: "",
  dateTo: "",
  uploadedFrom: "",
  uploadedTo: "",
  topAd: "",
};

const DATE_INPUT_CLASS =
  "h-9 rounded-[14px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent";

// "YYYY-MM-DD" date columns → "dd/mm/aaaa", read directly to avoid any timezone shift.
function formatDay(date: string | null) {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function ExpansionCreativesTable() {
  const supabase = createClient();
  const [rows, setRows] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  async function load() {
    const data = await listCreatives(supabase);
    setRows(data.filter((r) => r.unit === EXPANSION_UNIT));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["creatives"], load);

  const deliverers = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) if (r.deliverer) byId.set(r.deliverer.id, r.deliverer.full_name);
    return [...byId].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [rows]);

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

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const visibleRows = useMemo(() => {
    let result = rows.filter((row) => {
      if (filters.name && !row.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.deliveredBy && row.delivered_by !== filters.deliveredBy) return false;
      if (filters.dateFrom && (!row.delivered_at || row.delivered_at < filters.dateFrom)) return false;
      if (filters.dateTo && (!row.delivered_at || row.delivered_at > filters.dateTo)) return false;
      if (filters.uploadedFrom && (!row.uploaded_at || row.uploaded_at < filters.uploadedFrom)) return false;
      if (filters.uploadedTo && (!row.uploaded_at || row.uploaded_at > filters.uploadedTo)) return false;
      if (filters.topAd && row.top_ad !== (filters.topAd === "sim")) return false;
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

  // Filtering shows every match at once; pagination only applies to the unfiltered list.
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = hasActiveFilters
    ? visibleRows
    : visibleRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <FilterField label="Nome">
          <Input
            className="h-9 w-48"
            value={filters.name}
            onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
            placeholder="Buscar anúncio..."
          />
        </FilterField>
        <FilterField label="Entregue por">
          <div className="w-44">
            <Select
              className="h-9"
              value={filters.deliveredBy}
              onChange={(e) => setFilters((f) => ({ ...f, deliveredBy: e.target.value }))}
            >
              <option value="">Todos</option>
              {deliverers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        </FilterField>
        <FilterField label="Entrega de">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className={DATE_INPUT_CLASS}
          />
        </FilterField>
        <FilterField label="até">
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className={DATE_INPUT_CLASS}
          />
        </FilterField>
        <FilterField label="Subido de">
          <input
            type="date"
            value={filters.uploadedFrom}
            onChange={(e) => setFilters((f) => ({ ...f, uploadedFrom: e.target.value }))}
            className={DATE_INPUT_CLASS}
          />
        </FilterField>
        <FilterField label="até">
          <input
            type="date"
            value={filters.uploadedTo}
            onChange={(e) => setFilters((f) => ({ ...f, uploadedTo: e.target.value }))}
            className={DATE_INPUT_CLASS}
          />
        </FilterField>
        <FilterField label="Top Ads">
          <div className="w-28">
            <Select
              className="h-9"
              value={filters.topAd}
              onChange={(e) => setFilters((f) => ({ ...f, topAd: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </Select>
          </div>
        </FilterField>
        {hasActiveFilters && (
          <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)} className="gap-1">
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </Button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="font-bold uppercase text-gray-500">Legenda:</span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full border"
            style={{ background: "var(--color-success-bg)", borderColor: "var(--color-success)" }}
          />
          Já subido
        </span>
        {hasActiveFilters && (
          <span className="ml-auto">
            {visibleRows.length} {visibleRows.length === 1 ? "resultado" : "resultados"}
          </span>
        )}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase text-gray-500">
              {COLUMNS.map((col) => (
                <th key={col.label} className={cn(STICKY_TH, "px-4 py-3", col.widthClass)}>
                  {col.key ? (
                    <button
                      onClick={() => toggleSort(col.key!)}
                      className={cn(
                        "flex items-center gap-1 uppercase hover:text-blue-900",
                        sortField === col.key && "text-blue-900"
                      )}
                    >
                      {col.label}
                      {sortField === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
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
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-gray-100 last:border-0",
                  row.uploaded_at && "bg-[color:var(--color-success-bg)]"
                )}
              >
                <td className="px-4 py-3 font-semibold text-blue-900">{row.name || "—"}</td>
                <td className="px-4 py-3 text-gray-700">{row.deliverer?.full_name ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-gray-700">{formatDay(row.delivered_at)}</td>
                <td className="px-4 py-3">
                  {row.link ? (
                    <a
                      href={row.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={row.link}
                      className="flex max-w-64 items-center gap-1.5 font-semibold text-blue-900 hover:underline"
                    >
                      <span className="truncate">{row.link.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-700">{formatDay(row.uploaded_at)}</td>
                <td className="px-4 py-3">
                  {row.top_ad ? <Badge tone="accent">Sim</Badge> : <span className="text-gray-400">Não</span>}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-sm text-gray-400">
                  {loading
                    ? "Carregando..."
                    : rows.length === 0
                      ? "Nenhum criativo da Franqueadora cadastrado ainda."
                      : "Nenhum resultado para os filtros aplicados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!hasActiveFilters && (
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={visibleRows.length} onPageChange={setPage} />
      )}
    </div>
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
