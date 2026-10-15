"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Abas em formato de pasta: a aba ativa é branca e "derrete" no painel logo
// abaixo, com os cantos da base curvados para fora (bordas invertidas — ver
// .folder-tab-active no globals.css). Use para as seções de uma página.
export function FolderTabs({
  tabs,
  active,
  onChange,
  children,
  aside,
  className,
  bodyClassName,
}: {
  tabs: { key: string; label: string; icon?: LucideIcon; count?: number; alert?: boolean }[];
  active: string;
  onChange: (key: string) => void;
  children: React.ReactNode;
  /** conteúdo à direita das abas (ex.: seletor de período) */
  aside?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const first = tabs[0]?.key === active;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div role="tablist" className="-mb-px flex min-w-0 items-end gap-1 overflow-x-auto pr-[var(--ic-r)] pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t, i) => {
            const on = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onChange(t.key)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 rounded-t-[var(--ic-r)] px-4 text-[13px] font-semibold transition-colors",
                  on ? cn("folder-tab-active z-10 h-11 text-blue-900", i === 0 && "folder-tab-first") : "mb-1 h-9 rounded-b-[10px] text-gray-500 hover:bg-white/70 hover:text-blue-900"
                )}
              >
                {t.icon && <t.icon className={cn("h-4 w-4", on ? "text-yellow-600" : "text-gray-400")} />}
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-px text-[11px] font-bold tabular-nums",
                      t.alert && t.count > 0
                        ? "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]"
                        : on
                          ? "bg-yellow-100 text-blue-900"
                          : "bg-gray-200/80 text-gray-600"
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* no celular o aside sobe para cima das abas, para a aba ativa continuar colada no painel */}
        {aside && <div className="flex flex-wrap items-center gap-2 pb-2 max-sm:order-first max-sm:w-full">{aside}</div>}
      </div>
      <div className={cn("hm-card rounded-[18px] p-4 shadow-[var(--shadow-sm)] sm:p-5", first && "rounded-tl-none", bodyClassName)}>{children}</div>
    </div>
  );
}
