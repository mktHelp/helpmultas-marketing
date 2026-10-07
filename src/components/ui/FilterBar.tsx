"use client";

import { forwardRef } from "react";
import { ChevronDown, ListFilter, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra de filtros padrão: busca + filtros à esquerda, ações à direita.
 * No celular os itens quebram em linhas; nada estoura a largura da página.
 */
export function FilterBar({ children, actions, summary, className }: { children: React.ReactNode; actions?: React.ReactNode; summary?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {actions && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}
      </div>
      {summary && <p className="px-1 text-xs text-gray-500">{summary}</p>}
    </div>
  );
}

/** Lista suspensa no formato dos demais filtros (pílula de 40px). */
export const FilterSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }>(
  ({ className, children, label, ...props }, ref) => (
    <label className="relative block min-w-[9rem] max-w-full">
      {label && <span className="sr-only">{label}</span>}
      <select
        ref={ref}
        className={cn(
          "h-11 w-full appearance-none rounded-full border border-gray-200 bg-white pl-4 pr-9 text-base text-blue-900 outline-none transition-all sm:h-10 sm:text-sm",
          "hover:border-gray-300 focus:border-blue-900 focus:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
    </label>
  )
);
FilterSelect.displayName = "FilterSelect";

/** Botão que abre o painel lateral de filtros, com contador de filtros ativos. */
export function FilterButton({ count, onClick, label = "Filtros" }: { count: number; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border-2 px-4 font-display text-sm font-semibold transition-all active:scale-[0.97] sm:h-10",
        count > 0 ? "border-blue-900 bg-blue-900 text-white hover:bg-blue-800" : "border-blue-900 bg-white text-blue-900 hover:bg-blue-050"
      )}
    >
      <ListFilter className="h-4 w-4" />
      {label}
      {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-500 px-1 text-[11px] font-bold text-blue-900">{count}</span>}
    </button>
  );
}

/** Botão "Limpar filtros", só aparece quando há algo para limpar. */
export function ClearFilters({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button type="button" onClick={onClick} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-900 sm:h-10">
      <RotateCcw className="h-3.5 w-3.5" /> Limpar
    </button>
  );
}

export interface FilterChip {
  key: string;
  label: string;
  /** bolinha de cor opcional ao lado do texto */
  color?: string;
  remove: () => void;
}

/** Linha de pílulas com os filtros aplicados; cada uma remove só o seu filtro. */
export function FilterChips({ chips, onClear, className }: { chips: FilterChip[]; onClear: () => void; className?: string }) {
  if (!chips.length) return null;
  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>
      {chips.map((c) => (
        <span key={c.key} className="ast-pop inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1.5 text-xs font-semibold text-blue-900 shadow-[var(--shadow-sm)]" style={c.color ? { borderColor: `${c.color}66` } : undefined}>
          {c.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />}
          {c.label}
          <button type="button" onClick={c.remove} aria-label={`Remover filtro ${c.label}`} className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-900">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClear} className="px-1 text-xs font-bold text-gray-500 hover:text-[color:var(--color-danger)]">Limpar tudo</button>
    </div>
  );
}

/** Campo de data no formato dos demais filtros, com o rótulo ao lado. */
export function FilterDate({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-full border border-gray-200 bg-white px-3 text-base text-blue-900 outline-none transition-all hover:border-gray-300 focus:border-blue-900 focus:shadow-[var(--shadow-focus)] sm:h-10 sm:text-sm"
      />
    </label>
  );
}
