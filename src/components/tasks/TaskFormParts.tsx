"use client";

import { addDays, format } from "date-fns";
import {
  Check, Clapperboard, Globe, LayoutGrid, Layers, Mail, Megaphone, MessageCircle, Smartphone, Video, FileText,
  type LucideIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { cn } from "@/lib/utils";
import type { ContentType, Profile, TaskPriority, TaskStatusRow } from "@/types/database";

/** Peças de formulário compartilhadas pelo "Nova tarefa" e pela página da tarefa. */

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "baixa", label: "Baixa", color: "#7c8e98" },
  { value: "media", label: "Média", color: "#3b82f6" },
  { value: "alta", label: "Alta", color: "#e0a900" },
  { value: "urgente", label: "Urgente", color: "#c23b3b" },
];

export const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string; icon: LucideIcon }[] = [
  { value: "reels", label: "Reels", icon: Clapperboard },
  { value: "stories", label: "Stories", icon: Smartphone },
  { value: "feed", label: "Feed", icon: LayoutGrid },
  { value: "carrossel", label: "Carrossel", icon: Layers },
  { value: "youtube", label: "YouTube", icon: Video },
  { value: "blog", label: "Blog", icon: FileText },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "anuncio", label: "Anúncio", icon: Megaphone },
  { value: "landing_page", label: "Landing page", icon: Globe },
];

export function FieldLabel({ icon: Icon, children, htmlFor }: { icon?: LucideIcon; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-gray-500">
      {Icon && <Icon className="h-3.5 w-3.5 text-blue-700" />}
      {children}
    </label>
  );
}

export function PrioritySelector({
  value, onChange, disabled, compact,
}: {
  value: TaskPriority;
  onChange: (v: TaskPriority) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Prioridade">
      {PRIORITY_OPTIONS.map((p) => {
        const active = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(p.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-bold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
              compact ? "py-1.5" : "py-2.5",
              active ? "text-white shadow-md" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            )}
            style={active ? { backgroundColor: p.color, borderColor: p.color } : undefined}
          >
            <span className={cn("h-2 w-2 rounded-full", active && "ast-pop bg-white")} style={active ? undefined : { backgroundColor: p.color }} />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusSelector({
  statuses, value, onChange, disabled,
}: {
  statuses: TaskStatusRow[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Etapa">
      {statuses.map((s) => {
        const active = value === s.key;
        return (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(s.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
              active ? "border-transparent text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            )}
            style={active ? { backgroundColor: s.color } : undefined}
          >
            {active ? <Check className="ast-pop h-3 w-3" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function ContentTypeSelector({
  value, onChange, disabled,
}: {
  value: ContentType | "" | null;
  onChange: (v: ContentType | "") => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Tipo de conteúdo">
      {CONTENT_TYPE_OPTIONS.map((ct) => {
        const Icon = ct.icon;
        const active = value === ct.value;
        return (
          <button
            key={ct.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            // clicar de novo no tipo selecionado desmarca
            onClick={() => onChange(active ? "" : ct.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 text-[11px] font-bold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
              active ? "border-blue-900 bg-blue-900 text-white shadow-md" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-050"
            )}
          >
            <Icon className={cn("h-[18px] w-[18px] transition-transform duration-200", active ? "scale-110 text-yellow-400" : "text-blue-700")} />
            {ct.label}
          </button>
        );
      })}
    </div>
  );
}

export function AssigneeChips({
  profiles, selectedIds, onChange, disabled,
}: {
  profiles: Profile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }
  if (profiles.length === 0) return <p className="text-xs text-gray-400">Carregando equipe…</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {profiles.map((p) => {
        const active = selectedIds.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => toggle(p.id)}
            title={p.full_name}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
              active ? "border-yellow-500 bg-yellow-100 text-blue-900 shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            )}
          >
            <span className="relative">
              <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
              {active && (
                <span className="ast-pop absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500 ring-2 ring-white">
                  <Check className="h-2 w-2 text-blue-900" strokeWidth={4} />
                </span>
              )}
            </span>
            {p.full_name.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}

/** Atalhos de prazo: preenchem o campo de data (yyyy-MM-dd). */
export function QuickDates({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const options = [
    { label: "Hoje", date: format(new Date(), "yyyy-MM-dd") },
    { label: "Amanhã", date: format(addDays(new Date(), 1), "yyyy-MM-dd") },
    { label: "+3 dias", date: format(addDays(new Date(), 3), "yyyy-MM-dd") },
    { label: "+1 semana", date: format(addDays(new Date(), 7), "yyyy-MM-dd") },
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.date)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
            value === o.date ? "border-yellow-500 bg-yellow-100 text-blue-900" : "border-gray-200 text-gray-600 hover:bg-gray-050"
          )}
        >
          {o.label}
        </button>
      ))}
      {value && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("")}
          className="rounded-full px-2 py-1 text-[11px] font-bold text-gray-400 hover:text-[color:var(--color-danger)] disabled:opacity-60"
        >
          Limpar
        </button>
      )}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-[14px] border border-gray-200 bg-white px-3.5 text-blue-900 placeholder:text-gray-400 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10";
