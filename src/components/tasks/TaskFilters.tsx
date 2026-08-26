"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { listAreas } from "@/lib/services/reference";
import { listProfiles } from "@/lib/services/profiles";
import { useTaskStatuses } from "@/lib/task-status-context";
import type { Area, Profile } from "@/types/database";
import type { TaskFilters as Filters } from "@/lib/services/tasks";

const PRIORITY_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export function TaskFiltersBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { statuses } = useTaskStatuses();
  const supabase = createClient();

  useEffect(() => {
    listAreas(supabase).then(setAreas);
    listProfiles(supabase).then(setProfiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasFilters =
    filters.areaId?.length ||
    filters.assignedTo?.length ||
    filters.priority?.length ||
    filters.status?.length ||
    filters.onlyOverdue;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input
          placeholder="Buscar tarefas..."
          className="pl-9"
          value={filters.search || ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      <MultiSelect
        placeholder="Todas as áreas"
        options={areas.map((a) => ({ value: a.id, label: a.name, color: a.color }))}
        selected={filters.areaId || []}
        onChange={(values) => onChange({ ...filters, areaId: values.length ? values : undefined })}
      />

      <MultiSelect
        placeholder="Todos os responsáveis"
        options={profiles.map((p) => ({ value: p.id, label: p.full_name }))}
        selected={filters.assignedTo || []}
        onChange={(values) => onChange({ ...filters, assignedTo: values.length ? values : undefined })}
      />

      <MultiSelect
        placeholder="Toda prioridade"
        options={PRIORITY_OPTIONS}
        selected={filters.priority || []}
        onChange={(values) => onChange({ ...filters, priority: values.length ? values : undefined })}
      />

      <MultiSelect
        placeholder="Toda etapa"
        options={statuses.map((s) => ({ value: s.key, label: s.label, color: s.color }))}
        selected={filters.status || []}
        onChange={(values) => onChange({ ...filters, status: values.length ? values : undefined })}
      />

      <button
        onClick={() => onChange({ ...filters, onlyOverdue: !filters.onlyOverdue })}
        className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
          filters.onlyOverdue ? "bg-[color:var(--color-danger)] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        Atrasadas
      </button>

      {hasFilters && (
        <button
          onClick={() => onChange({ search: filters.search })}
          className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-blue-900"
        >
          <X className="h-4 w-4" /> Limpar
        </button>
      )}
    </div>
  );
}
