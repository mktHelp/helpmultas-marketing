"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CalendarRange, Check, ChevronDown, Flag, Layers, ListFilter, User, Users, X, Zap,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { listAreas } from "@/lib/services/reference";
import { listProfiles } from "@/lib/services/profiles";
import { useTaskStatuses } from "@/lib/task-status-context";
import { useAuth } from "@/lib/auth-context";
import { cn, dateInputToISO, dateInputToStartOfDayISO, isoToDateInputValue } from "@/lib/utils";
import type { Area, Profile } from "@/types/database";
import type { TaskFilters } from "@/lib/services/tasks";
import { SearchInput } from "@/components/ui/SearchInput";

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "#7c8e98" },
  { value: "media", label: "Média", color: "#4a6a80" },
  { value: "alta", label: "Alta", color: "#e0a900" },
  { value: "urgente", label: "Urgente", color: "#c23b3b" },
];

export function countActiveFilters(f: TaskFilters) {
  return (
    (f.search?.trim() ? 1 : 0) +
    (f.areaId?.length ? 1 : 0) +
    (f.assignedTo?.length ? 1 : 0) +
    (f.priority?.length ? 1 : 0) +
    (f.status?.length ? 1 : 0) +
    (f.onlyOverdue ? 1 : 0) +
    (f.createdFrom || f.createdTo ? 1 : 0) +
    (f.movedFrom || f.movedTo ? 1 : 0)
  );
}

function toggle(list: string[] | undefined, value: string) {
  const current = list ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return next.length ? next : undefined;
}

function Section({
  icon: Icon,
  title,
  count,
  defaultOpen = true,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-100 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Icon className="h-4 w-4 text-blue-700" />
        <span className="flex-1 font-display text-[13px] font-bold text-blue-900">{title}</span>
        {!!count && (
          <span className="ast-pop rounded-full bg-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-blue-900">{count}</span>
        )}
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  color,
  selected,
  onClick,
  children,
}: {
  label: string;
  color: string;
  selected: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all duration-200 active:scale-95",
        selected ? "border-transparent text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-050"
      )}
      style={selected ? { backgroundColor: color } : undefined}
    >
      {selected ? (
        <Check className="ast-pop h-3 w-3" strokeWidth={3} />
      ) : (
        children ?? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
    </button>
  );
}

/**
 * Gaveta de filtros do quadro. Edita um RASCUNHO dos filtros: nada muda no
 * quadro até clicar em "Aplicar", que aplica e fecha. Fechar sem aplicar
 * descarta o rascunho (o componente é montado do zero a cada abertura).
 */
export function BoardFilterSidebar({
  applied,
  onApply,
  resultCount,
  onClose,
}: {
  applied: TaskFilters;
  onApply: (f: TaskFilters) => void;
  resultCount: number;
  onClose: () => void;
}) {
  const [filters, onChange] = useState<TaskFilters>(applied);
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useAuth();
  const { statuses } = useTaskStatuses();
  const [areas, setAreas] = useState<Area[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    listAreas(supabase).then(setAreas).catch(() => {});
    listProfiles(supabase).then(setProfiles).catch(() => {});
  }, [supabase]);

  const search = filters.search ?? "";
  const setSearch = (value: string) => onChange((prev) => ({ ...prev, search: value || undefined }));

  const activeCount = countActiveFilters(filters);
  const mine = !!profile && filters.assignedTo?.length === 1 && filters.assignedTo[0] === profile.id;

  function clearAll() {
    onChange({});
  }

  function apply() {
    onApply({ ...filters, search: filters.search?.trim() || undefined });
  }


  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-900 text-yellow-500">
          <ListFilter className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-display text-sm font-bold text-blue-900">Filtros</p>
          <p className="text-[11px] text-gray-500">
            {resultCount} {resultCount === 1 ? "tarefa" : "tarefas"} no quadro ·{" "}
            {activeCount > 0 ? `${activeCount} ${activeCount === 1 ? "selecionado" : "selecionados"}` : "sem filtros"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar filtros" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <SearchInput value={search} onChange={setSearch} onEnter={apply} placeholder="Buscar tarefas..." className="max-w-none sm:max-w-none" />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...filters, onlyOverdue: filters.onlyOverdue ? undefined : true })}
              aria-pressed={!!filters.onlyOverdue}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-all active:scale-95",
                filters.onlyOverdue
                  ? "border-transparent bg-[color:var(--color-danger)] text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-700 hover:border-red-200 hover:bg-[color:var(--color-danger-bg)]"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Atrasadas
            </button>
            <button
              type="button"
              disabled={!profile}
              onClick={() => profile && onChange({ ...filters, assignedTo: mine ? undefined : [profile.id] })}
              aria-pressed={mine}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-50",
                mine
                  ? "border-transparent bg-blue-900 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-050"
              )}
            >
              <User className="h-3.5 w-3.5" />
              Minhas
            </button>
          </div>
        </div>

        <Section icon={Layers} title="Etapas" count={filters.status?.length}>
          <div className="flex flex-wrap gap-1.5">
            {statuses
              .filter((s) => s.is_active)
              .map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  color={s.color}
                  selected={!!filters.status?.includes(s.key)}
                  onClick={() => onChange({ ...filters, status: toggle(filters.status, s.key) })}
                />
              ))}
          </div>
        </Section>

        <Section icon={Flag} title="Prioridade" count={filters.priority?.length}>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <Chip
                key={p.value}
                label={p.label}
                color={p.color}
                selected={!!filters.priority?.includes(p.value)}
                onClick={() => onChange({ ...filters, priority: toggle(filters.priority, p.value) })}
              />
            ))}
          </div>
        </Section>

        <Section icon={Users} title="Responsáveis" count={filters.assignedTo?.length}>
          <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
            {profiles.map((p) => {
              const selected = !!filters.assignedTo?.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ ...filters, assignedTo: toggle(filters.assignedTo, p.id) })}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] font-semibold transition-colors",
                    selected ? "bg-yellow-050 text-blue-900" : "text-gray-700 hover:bg-gray-050"
                  )}
                >
                  <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{p.full_name}</span>
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border transition-all",
                      selected ? "border-yellow-500 bg-yellow-500 text-blue-900" : "border-gray-300"
                    )}
                  >
                    {selected && <Check className="ast-pop h-3 w-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
            {profiles.length === 0 && <p className="py-2 text-xs text-gray-400">Carregando…</p>}
          </div>
        </Section>

        <Section icon={Zap} title="Áreas" count={filters.areaId?.length} defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {areas.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                color={a.color}
                selected={!!filters.areaId?.includes(a.id)}
                onClick={() => onChange({ ...filters, areaId: toggle(filters.areaId, a.id) })}
              />
            ))}
            {areas.length === 0 && <p className="text-xs text-gray-400">Nenhuma área cadastrada.</p>}
          </div>
        </Section>

        <Section icon={CalendarRange} title="Datas" count={(filters.createdFrom || filters.createdTo ? 1 : 0) + (filters.movedFrom || filters.movedTo ? 1 : 0)} defaultOpen={false}>
          <div className="space-y-3">
            {[
              { label: "Criada entre", from: "createdFrom", to: "createdTo" },
              { label: "Movida entre", from: "movedFrom", to: "movedTo" },
            ].map((range) => (
              <div key={range.label}>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">{range.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    aria-label={`${range.label} (início)`}
                    value={isoToDateInputValue(filters[range.from as keyof TaskFilters] as string | undefined)}
                    onChange={(e) =>
                      onChange({ ...filters, [range.from]: e.target.value ? dateInputToStartOfDayISO(e.target.value) : undefined })
                    }
                    className="h-9 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-2 text-xs text-blue-900 outline-none focus:border-blue-900"
                  />
                  <input
                    type="date"
                    aria-label={`${range.label} (fim)`}
                    value={isoToDateInputValue(filters[range.to as keyof TaskFilters] as string | undefined)}
                    onChange={(e) =>
                      onChange({ ...filters, [range.to]: e.target.value ? dateInputToISO(e.target.value) : undefined })
                    }
                    className="h-9 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-2 text-xs text-blue-900 outline-none focus:border-blue-900"
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white p-3">
        <button
          type="button"
          onClick={clearAll}
          disabled={activeCount === 0}
          className="h-10 rounded-full px-4 font-display text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={apply}
          className="h-10 flex-1 rounded-full bg-yellow-500 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.97]"
        >
          Aplicar filtros
        </button>
      </div>
    </div>
  );
}
