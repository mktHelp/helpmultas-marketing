"use client";

import { useState } from "react";
import { AlertTriangle, Check, Flag, Layers, ListFilter, Palette, User, Users, X, Zap } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useTaskStatuses } from "@/lib/task-status-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { Area, Profile } from "@/types/database";
import { Chip, Section } from "./BoardFilterSidebar";
import { TASK_COLORS } from "./TaskColorPicker";

export interface CalFilters {
  search: string;
  assignees: string[];
  statuses: string[];
  priorities: string[];
  areas: string[];
  /** hex das cores, ou NO_COLOR para tarefas sem cor */
  colors: string[];
  onlyOverdue: boolean;
}

export const NO_COLOR = "none";
export const NO_CAL_FILTERS: CalFilters = { search: "", assignees: [], statuses: [], priorities: [], areas: [], colors: [], onlyOverdue: false };

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "#7c8e98" },
  { value: "media", label: "Média", color: "#4a6a80" },
  { value: "alta", label: "Alta", color: "#e0a900" },
  { value: "urgente", label: "Urgente", color: "#c23b3b" },
];

export function countCalFilters(f: CalFilters) {
  return (
    (f.search.trim() ? 1 : 0) + (f.assignees.length ? 1 : 0) + (f.statuses.length ? 1 : 0) +
    (f.priorities.length ? 1 : 0) + (f.areas.length ? 1 : 0) + (f.colors.length ? 1 : 0) + (f.onlyOverdue ? 1 : 0)
  );
}

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Gaveta de filtros do Calendário (mesmo padrão do Quadro): edita um rascunho e só aplica em "Aplicar filtros". */
export function CalendarFilterSidebar({
  applied, profiles, areas, resultCount, onApply, onClose,
}: {
  applied: CalFilters;
  profiles: Profile[];
  areas: Area[];
  resultCount: number;
  onApply: (f: CalFilters) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<CalFilters>(applied);
  const { profile } = useAuth();
  const { statuses } = useTaskStatuses();
  const active = countCalFilters(f);
  const mine = !!profile && f.assignees.length === 1 && f.assignees[0] === profile.id;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-900 text-yellow-500">
          <ListFilter className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-display text-sm font-bold text-blue-900">Filtros</p>
          <p className="text-[11px] text-gray-500">
            {resultCount} {resultCount === 1 ? "tarefa" : "tarefas"} no calendário ·{" "}
            {active > 0 ? `${active} ${active === 1 ? "selecionado" : "selecionados"}` : "sem filtros"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar filtros" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setF({ ...f, onlyOverdue: !f.onlyOverdue })}
              aria-pressed={f.onlyOverdue}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-all active:scale-95",
                f.onlyOverdue
                  ? "border-transparent bg-[color:var(--color-danger)] text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-700 hover:border-red-200 hover:bg-[color:var(--color-danger-bg)]"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Atrasadas
            </button>
            <button
              type="button"
              disabled={!profile}
              onClick={() => profile && setF({ ...f, assignees: mine ? [] : [profile.id] })}
              aria-pressed={mine}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-50",
                mine ? "border-transparent bg-blue-900 text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-050"
              )}
            >
              <User className="h-3.5 w-3.5" /> Minhas
            </button>
          </div>
        </div>

        <Section icon={Users} title="Responsáveis" count={f.assignees.length}>
          <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
            {profiles.map((p) => {
              const selected = f.assignees.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setF({ ...f, assignees: toggle(f.assignees, p.id) })}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] font-semibold transition-colors",
                    selected ? "bg-yellow-050 text-blue-900" : "text-gray-700 hover:bg-gray-050"
                  )}
                >
                  <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{p.full_name}</span>
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border transition-all", selected ? "border-yellow-500 bg-yellow-500 text-blue-900" : "border-gray-300")}>
                    {selected && <Check className="ast-pop h-3 w-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
            {profiles.length === 0 && <p className="py-2 text-xs text-gray-400">Carregando…</p>}
          </div>
        </Section>

        <Section icon={Layers} title="Etapas" count={f.statuses.length}>
          <div className="flex flex-wrap gap-1.5">
            {statuses.filter((s) => s.is_active).map((s) => (
              <Chip key={s.key} label={s.label} color={s.color} selected={f.statuses.includes(s.key)} onClick={() => setF({ ...f, statuses: toggle(f.statuses, s.key) })} />
            ))}
          </div>
        </Section>

        <Section icon={Flag} title="Prioridade" count={f.priorities.length}>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <Chip key={p.value} label={p.label} color={p.color} selected={f.priorities.includes(p.value)} onClick={() => setF({ ...f, priorities: toggle(f.priorities, p.value) })} />
            ))}
          </div>
        </Section>

        <Section icon={Palette} title="Cor da tarefa" count={f.colors.length}>
          <div className="flex flex-wrap gap-1.5">
            {TASK_COLORS.map((c) => (
              <Chip key={c.value} label={c.label} color={c.value} selected={f.colors.includes(c.value)} onClick={() => setF({ ...f, colors: toggle(f.colors, c.value) })} />
            ))}
            <Chip label="Sem cor" color="#7c8e98" selected={f.colors.includes(NO_COLOR)} onClick={() => setF({ ...f, colors: toggle(f.colors, NO_COLOR) })} />
          </div>
        </Section>

        <Section icon={Zap} title="Áreas" count={f.areas.length} defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {areas.map((a) => (
              <Chip key={a.id} label={a.name} color={a.color} selected={f.areas.includes(a.id)} onClick={() => setF({ ...f, areas: toggle(f.areas, a.id) })} />
            ))}
            {areas.length === 0 && <p className="text-xs text-gray-400">Nenhuma área cadastrada.</p>}
          </div>
        </Section>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white p-3">
        <button
          type="button"
          onClick={() => setF({ ...NO_CAL_FILTERS, search: f.search })}
          disabled={countCalFilters({ ...f, search: "" }) === 0}
          className="h-10 rounded-full px-4 font-display text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={() => onApply(f)}
          className="h-10 flex-1 rounded-full bg-yellow-500 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.97]"
        >
          Aplicar filtros
        </button>
      </div>
    </div>
  );
}
