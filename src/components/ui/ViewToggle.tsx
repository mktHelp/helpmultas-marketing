"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Table2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Visão escolhida pela pessoa (cartões × planilha etc.), lembrada entre visitas. */
export function usePersistentView<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [view, setView] = useState<T>(fallback);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key) as T | null;
      if (saved && allowed.includes(saved)) setView(saved);
    } catch {
      // sem localStorage: fica o padrão
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const change = (next: T) => {
    setView(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // segue sem lembrar
    }
  };
  return [view, change] as const;
}

const DEFAULT_OPTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "table", label: "Planilha", icon: Table2 },
  { key: "cards", label: "Cartões", icon: LayoutGrid },
];

/** Alternador compacto de visão, só com ícones (o rótulo aparece no title/aria-label). */
export function ViewToggle({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
}: {
  value: string;
  onChange: (key: string) => void;
  options?: { key: string; label: string; icon: LucideIcon }[];
}) {
  return (
    <div role="radiogroup" aria-label="Visão" className="flex items-center gap-0.5 rounded-[10px] border border-gray-200 bg-white p-[3px]">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.key)}
            className={cn("flex h-7 items-center gap-1.5 rounded-[7px] px-2 text-xs font-bold transition-colors", on ? "bg-blue-900 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-blue-900")}
          >
            <o.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
