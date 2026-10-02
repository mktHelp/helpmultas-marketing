"use client";

import { X } from "lucide-react";
import { useTaskStatuses } from "@/lib/task-status-context";
import { formatDate } from "@/lib/utils";
import type { Area, Profile } from "@/types/database";
import type { TaskFilters } from "@/lib/services/tasks";

const PRIORITY_LABEL: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };

interface Chip {
  key: string;
  label: string;
  color: string;
  remove: () => void;
}

/** Linha de "pílulas" com os filtros aplicados; cada uma remove só o seu filtro. */
export function ActiveFilterChips({
  filters,
  onChange,
  profiles,
  areas,
}: {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  profiles: Pick<Profile, "id" | "full_name">[];
  areas: Pick<Area, "id" | "name" | "color">[];
}) {
  const { byKey } = useTaskStatuses();
  const chips: Chip[] = [];

  const without = <K extends keyof TaskFilters>(key: K, value?: string) => () => {
    const current = filters[key];
    if (Array.isArray(current) && value !== undefined) {
      const next = (current as string[]).filter((v) => v !== value);
      onChange({ ...filters, [key]: next.length ? next : undefined });
    } else {
      onChange({ ...filters, [key]: undefined });
    }
  };

  if (filters.search?.trim()) chips.push({ key: "search", label: `“${filters.search.trim()}”`, color: "#243746", remove: without("search") });
  for (const s of filters.status ?? []) chips.push({ key: `st-${s}`, label: byKey[s]?.label ?? s, color: byKey[s]?.color ?? "#7c8e98", remove: without("status", s) });
  for (const p of filters.priority ?? []) chips.push({ key: `pr-${p}`, label: `Prioridade ${PRIORITY_LABEL[p] ?? p}`, color: p === "urgente" ? "#c23b3b" : p === "alta" ? "#e0a900" : "#4a6a80", remove: without("priority", p) });
  for (const id of filters.assignedTo ?? []) chips.push({ key: `as-${id}`, label: profiles.find((p) => p.id === id)?.full_name ?? "Responsável", color: "#375367", remove: without("assignedTo", id) });
  for (const id of filters.areaId ?? []) {
    const area = areas.find((a) => a.id === id);
    chips.push({ key: `ar-${id}`, label: area?.name ?? "Área", color: area?.color ?? "#4a6a80", remove: without("areaId", id) });
  }
  if (filters.onlyOverdue) chips.push({ key: "overdue", label: "Atrasadas", color: "#c23b3b", remove: without("onlyOverdue") });
  if (filters.createdFrom || filters.createdTo) {
    chips.push({
      key: "created",
      label: `Criada ${filters.createdFrom ? formatDate(filters.createdFrom) : "…"} – ${filters.createdTo ? formatDate(filters.createdTo) : "…"}`,
      color: "#4a6a80",
      remove: () => onChange({ ...filters, createdFrom: undefined, createdTo: undefined }),
    });
  }
  if (filters.movedFrom || filters.movedTo) {
    chips.push({
      key: "moved",
      label: `Movida ${filters.movedFrom ? formatDate(filters.movedFrom) : "…"} – ${filters.movedTo ? formatDate(filters.movedTo) : "…"}`,
      color: "#4a6a80",
      remove: () => onChange({ ...filters, movedFrom: undefined, movedTo: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span
          key={c.key}
          className="ast-pop inline-flex items-center gap-1.5 rounded-full border bg-white py-1 pl-2.5 pr-1.5 text-xs font-semibold text-blue-900 shadow-[var(--shadow-sm)]"
          style={{ borderColor: `${c.color}66` }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
          {c.label}
          <button
            type="button"
            onClick={c.remove}
            aria-label={`Remover filtro ${c.label}`}
            className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-900"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => onChange({})} className="px-1 text-xs font-bold text-gray-500 hover:text-[color:var(--color-danger)]">
        Limpar tudo
      </button>
    </div>
  );
}
