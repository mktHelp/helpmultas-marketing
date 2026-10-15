"use client";

import { useState } from "react";
import { Check, ListFilter, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Gaveta de filtros da aba Reuniões — mesmo padrão dos Criativos/Tarefas: edita um
// rascunho e só aplica ao clicar em "Aplicar filtros".

export interface MeetingFilters {
  campaignIds: string[];
  stages: string[];
  categories: string[];
  meeting: string;
  statuses: string[];
}

export const EMPTY_MEETING_FILTERS: MeetingFilters = { campaignIds: [], stages: [], categories: [], meeting: "", statuses: [] };

export function countMeetingFilters(f: MeetingFilters) {
  return f.campaignIds.length + f.stages.length + f.categories.length + (f.meeting ? 1 : 0) + f.statuses.length;
}

export interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

function Chip({ active, color, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all active:scale-95",
        active ? "border-transparent text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      )}
      style={active ? { backgroundColor: color ?? "#243746" } : undefined}
    >
      {active && <Check className="ast-pop h-3 w-3" strokeWidth={3} />}
      {children}
    </button>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 px-4 py-4 first:border-t-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
      {hint && <p className="mb-2.5 mt-0.5 text-[11px] text-gray-400">{hint}</p>}
      <div className={hint ? "" : "mt-2.5"}>{children}</div>
    </div>
  );
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function MeetingsFilterPanel({
  applied,
  campaignOptions,
  stageOptions,
  categoryOptions,
  meetingOptions,
  statusOptions,
  resultCount,
  onApply,
  onClose,
}: {
  applied: MeetingFilters;
  campaignOptions: FilterOption[];
  stageOptions: FilterOption[];
  categoryOptions: FilterOption[];
  meetingOptions: FilterOption[];
  statusOptions: FilterOption[];
  resultCount: number;
  onApply: (f: MeetingFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MeetingFilters>(applied);
  const set = <K extends keyof MeetingFilters>(key: K, value: MeetingFilters[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const count = countMeetingFilters(draft);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-900 text-yellow-500">
          <ListFilter className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-display text-sm font-bold text-blue-900">Filtros</p>
          <p className="text-[11px] text-gray-500">
            {resultCount} {resultCount === 1 ? "lead" : "leads"} agora · {count > 0 ? `${count} ${count === 1 ? "selecionado" : "selecionados"}` : "sem filtros"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar filtros" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="bg-blue-050 px-4 py-2 text-[11px] text-blue-800">Os filtros valem para a página toda: cards, funil, tabelas e lista.</p>

        <Group title="Reuniões">
          <div className="flex flex-wrap gap-1.5">
            {meetingOptions.map((o) => (
              <Chip key={o.value || "all"} active={draft.meeting === o.value} onClick={() => set("meeting", o.value)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Group>

        <Group title="Categoria (fase do CRM)">
          <div className="flex flex-wrap gap-1.5">
            {categoryOptions.map((o) => (
              <Chip key={o.value} active={draft.categories.includes(o.value)} color={o.color} onClick={() => set("categories", toggle(draft.categories, o.value))}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Group>

        <Group title="Etapa do CRM">
          {stageOptions.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma etapa ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {stageOptions.map((o) => (
                <Chip key={o.value} active={draft.stages.includes(o.value)} onClick={() => set("stages", toggle(draft.stages, o.value))}>
                  {o.label}
                </Chip>
              ))}
            </div>
          )}
        </Group>

        <Group title="Status da última reunião">
          {statusOptions.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum status ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((o) => (
                <Chip key={o.value} active={draft.statuses.includes(o.value)} onClick={() => set("statuses", toggle(draft.statuses, o.value))}>
                  {o.label}
                </Chip>
              ))}
            </div>
          )}
        </Group>

        <Group title="Campanha">
          <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
            {campaignOptions.map((o) => {
              const active = draft.campaignIds.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set("campaignIds", toggle(draft.campaignIds, o.value))}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] font-semibold transition-colors",
                    active ? "bg-yellow-050 text-blue-900" : "text-gray-700 hover:bg-gray-050"
                  )}
                >
                  <span className="min-w-0 flex-1">{o.label}</span>
                  {active && <Check className="ast-pop h-3.5 w-3.5 shrink-0 text-yellow-600" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </Group>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white p-3">
        <button
          type="button"
          onClick={() => setDraft(EMPTY_MEETING_FILTERS)}
          disabled={count === 0}
          className="h-10 rounded-full px-4 font-display text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={() => onApply(draft)}
          className="h-10 flex-1 rounded-full bg-yellow-500 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.97]"
        >
          Aplicar filtros
        </button>
      </div>
    </div>
  );
}
