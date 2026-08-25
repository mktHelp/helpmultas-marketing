"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { listAreas } from "@/lib/services/reference";
import { listProfiles } from "@/lib/services/profiles";
import { useTaskStatuses } from "@/lib/task-status-context";
import type { Area, Profile } from "@/types/database";
import type { TaskFilters as Filters } from "@/lib/services/tasks";

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
    filters.areaId || filters.assignedTo || filters.priority?.length || filters.status?.length || filters.onlyOverdue;

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

      <Select
        className="w-auto"
        value={filters.areaId || ""}
        onChange={(e) => onChange({ ...filters, areaId: e.target.value || undefined })}
      >
        <option value="">Todas as áreas</option>
        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>

      <Select
        className="w-auto"
        value={filters.assignedTo || ""}
        onChange={(e) => onChange({ ...filters, assignedTo: e.target.value || undefined })}
      >
        <option value="">Todos os responsáveis</option>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
      </Select>

      <Select
        className="w-auto"
        value={filters.priority?.[0] || ""}
        onChange={(e) => onChange({ ...filters, priority: e.target.value ? [e.target.value] : undefined })}
      >
        <option value="">Toda prioridade</option>
        <option value="baixa">Baixa</option>
        <option value="media">Média</option>
        <option value="alta">Alta</option>
        <option value="urgente">Urgente</option>
      </Select>

      <Select
        className="w-auto"
        value={filters.status?.[0] || ""}
        onChange={(e) => onChange({ ...filters, status: e.target.value ? [e.target.value] : undefined })}
      >
        <option value="">Toda etapa</option>
        {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </Select>

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
