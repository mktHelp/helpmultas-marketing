"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Abas em formato de pasta: a aba ativa é branca e "derrete" no painel logo
// abaixo, com os cantos da base curvados para fora (borda invertida), feitos
// com um radial-gradient em cada lado.
export function FolderTabs({
  tabs,
  active,
  onChange,
  children,
}: {
  tabs: { key: string; label: string; icon: LucideIcon; count?: number; alert?: boolean }[];
  active: string;
  onChange: (key: string) => void;
  children: React.ReactNode;
}) {
  const first = tabs[0]?.key === active;
  return (
    <div>
      <div role="tablist" className="flex items-end gap-1 overflow-x-auto px-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.key)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-t-2xl px-5 text-sm font-semibold transition-colors",
                on
                  ? [
                      "z-10 h-12 bg-white text-blue-900",
                      // cantos invertidos (só aparecem na aba ativa)
                      "before:pointer-events-none before:absolute before:bottom-0 before:-left-4 before:h-4 before:w-4",
                      "before:bg-[radial-gradient(circle_at_0_0,transparent_15.5px,#fff_16px)]",
                      "after:pointer-events-none after:absolute after:bottom-0 after:-right-4 after:h-4 after:w-4",
                      "after:bg-[radial-gradient(circle_at_100%_0,transparent_15.5px,#fff_16px)]",
                    ]
                  : "mb-1 h-10 rounded-b-2xl bg-white/50 text-gray-600 hover:bg-white/80 hover:text-blue-900",
              )}
            >
              <t.icon className={cn("h-4 w-4", on && "text-yellow-600")} />
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                    t.alert && t.count > 0
                      ? "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]"
                      : on
                        ? "bg-yellow-100 text-blue-900"
                        : "bg-gray-200 text-gray-700",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className={cn("rounded-3xl bg-white p-4 shadow-[var(--shadow-sm)] sm:p-6", first && "rounded-tl-none")}>{children}</div>
    </div>
  );
}
