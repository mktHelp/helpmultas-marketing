"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { createCreative, deleteCreative, listCreatives, updateCreative } from "@/lib/services/creatives";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { cn } from "@/lib/utils";
import type { Creative, Profile } from "@/types/database";

const TEXT_FIELDS = ["name", "unit", "link"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

type SortField = "name" | "unit" | "deliverer" | "delivered_at";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "unit", label: "Unidade" },
  { key: "deliverer", label: "Nome de quem entregou" },
  { key: "delivered_at", label: "Data de entrega do arquivo" },
];

export function CreativesTable({ profiles }: { profiles: Profile[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Creative[]>([]);
  const editingCell = useRef<string | null>(null); // `${rowId}:${field}` currently being typed into
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState({
    name: "",
    unit: "",
    deliveredBy: "",
    link: "",
    dateFrom: "",
    dateTo: "",
    topAd: "",
  });

  async function load() {
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
    const created = await createCreative(supabase, { sort_order: rows.length });
    setRows((prev) => [...prev, created]);
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

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const visibleRows = useMemo(() => {
    let result = rows.filter((row) => {
      if (filters.name && !row.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.unit && !row.unit.toLowerCase().includes(filters.unit.toLowerCase())) return false;
      if (filters.link && !row.link.toLowerCase().includes(filters.link.toLowerCase())) return false;
      if (filters.deliveredBy && row.delivered_by !== filters.deliveredBy) return false;
      if (filters.dateFrom && (!row.delivered_at || row.delivered_at < filters.dateFrom)) return false;
      if (filters.dateTo && (!row.delivered_at || row.delivered_at > filters.dateTo)) return false;
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

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <FilterField label="Nome">
            <Input
              className="h-9 w-40"
              value={filters.name}
              onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
              placeholder="Filtrar..."
            />
          </FilterField>
          <FilterField label="Unidade">
            <Input
              className="h-9 w-32"
              value={filters.unit}
              onChange={(e) => setFilters((f) => ({ ...f, unit: e.target.value }))}
              placeholder="Filtrar..."
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
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
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
              className="h-9 rounded-[14px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </FilterField>
          <FilterField label="até">
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="h-9 rounded-[14px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </FilterField>
          <FilterField label="Link">
            <Input
              className="h-9 w-36"
              value={filters.link}
              onChange={(e) => setFilters((f) => ({ ...f, link: e.target.value }))}
              placeholder="Filtrar..."
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setFilters({ name: "", unit: "", deliveredBy: "", link: "", dateFrom: "", dateTo: "", topAd: "" })
              }
              className="gap-1"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          )}
        </div>

        <Button size="sm" variant="secondary" onClick={addRow} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Nova linha
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-050 text-left text-xs font-bold uppercase text-gray-500">
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-2.5">
                  <button
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "flex items-center gap-1 hover:text-blue-900",
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
                </th>
              ))}
              <th className="px-3 py-2.5">Link de criativos</th>
              <th className="px-3 py-2.5">Top Ads</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                <EditableCell
                  value={row.name}
                  onChange={(v) => handleTextChange(row.id, "name", v)}
                  onFocus={() => (editingCell.current = `${row.id}:name`)}
                  onBlur={() => (editingCell.current = null)}
                  placeholder="Nome do criativo"
                />
                <EditableCell
                  value={row.unit}
                  onChange={(v) => handleTextChange(row.id, "unit", v)}
                  onFocus={() => (editingCell.current = `${row.id}:unit`)}
                  onBlur={() => (editingCell.current = null)}
                  placeholder="Unidade"
                />
                <td className="px-2 py-1.5">
                  <Select
                    className="h-9"
                    value={row.delivered_by ?? ""}
                    onChange={(e) => handleFieldSave(row.id, { delivered_by: e.target.value || null })}
                  >
                    <option value="">Selecionar...</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    value={row.delivered_at ?? ""}
                    onChange={(e) => handleFieldSave(row.id, { delivered_at: e.target.value || null })}
                    className="h-9 w-full rounded-[10px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </td>
                <EditableCell
                  value={row.link}
                  onChange={(v) => handleTextChange(row.id, "link", v)}
                  onFocus={() => (editingCell.current = `${row.id}:link`)}
                  onBlur={() => (editingCell.current = null)}
                  placeholder="https://..."
                />
                <td className="px-2 py-1.5">
                  <Select
                    className="h-9"
                    value={row.top_ad ? "sim" : "nao"}
                    onChange={(e) => handleFieldSave(row.id, { top_ad: e.target.value === "sim" })}
                  >
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </Select>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => removeRow(row.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-[color:var(--color-danger)]"
                    aria-label="Remover linha"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-400">
                  {rows.length === 0 ? "Nenhum criativo cadastrado ainda." : "Nenhum resultado para os filtros aplicados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

function EditableCell({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
}) {
  return (
    <td className="px-2 py-1.5">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className="h-9 w-full rounded-[10px] border border-transparent bg-transparent px-2.5 text-sm text-blue-900 placeholder:text-gray-400 hover:border-gray-200 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
    </td>
  );
}
