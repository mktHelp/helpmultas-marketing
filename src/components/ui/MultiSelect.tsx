"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "./Checkbox";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  color?: string;
}

export function MultiSelect({
  placeholder,
  options,
  selected,
  onChange,
  className,
}: {
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label || placeholder
        : `${placeholder} (${selected.length})`;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-auto min-w-[160px] items-center gap-2 rounded-[14px] border border-gray-200 bg-white px-3.5 text-left text-sm",
          "focus:outline-none focus:ring-2 focus:ring-yellow-500",
          selected.length > 0 ? "text-blue-900 font-semibold" : "text-gray-500"
        )}
      >
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-[var(--shadow-lg)]">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full border-b border-gray-100 px-3.5 py-2 text-left text-xs font-semibold text-gray-500 hover:bg-gray-050"
            >
              Limpar seleção
            </button>
          )}
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-gray-050"
            >
              <Checkbox checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
              {opt.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />}
              <span className="truncate text-blue-900">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
