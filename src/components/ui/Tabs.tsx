"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Abas segmentadas (filtros, períodos, visões). Para seções de página use FolderTabs. */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { key: string; label: string; count?: number; icon?: LucideIcon }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    // Em telas estreitas as abas rolam na horizontal em vez de estourar a página.
    <div role="tablist" className={cn("flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[11px] border border-gray-200/80 bg-gray-100/80 p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {tabs.map((tab) => {
        const on = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold transition-all",
              on ? "bg-white text-blue-900 shadow-[0_1px_2px_rgba(23,36,44,0.08)]" : "text-gray-500 hover:text-blue-900"
            )}
          >
            {tab.icon && <tab.icon className={cn("h-3.5 w-3.5", on && "text-yellow-600")} />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn("rounded-md px-1.5 text-[11px] font-bold tabular-nums", on ? "bg-yellow-100 text-blue-900" : "bg-gray-200/80 text-gray-600")}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
