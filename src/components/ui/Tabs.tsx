"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div role="tablist" className={cn("flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-gray-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
            active === tab.key ? "bg-white text-blue-900 shadow-sm" : "text-gray-700 hover:text-blue-900"
          )}
        >
          {tab.icon && <tab.icon className={cn("h-4 w-4", active === tab.key && "text-yellow-600")} />}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px]",
                active === tab.key ? "bg-yellow-100 text-blue-900" : "bg-gray-200 text-gray-700"
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
