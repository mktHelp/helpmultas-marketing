"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

export function AssigneesPicker({
  profiles,
  selectedIds,
  onChange,
  disabled,
}: {
  profiles: Profile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = profiles.filter((p) => selectedIds.includes(p.id));

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[14px] border border-gray-200 bg-white px-2.5 py-1.5 text-left text-sm",
          "focus:outline-none focus:ring-2 focus:ring-yellow-500",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {selected.length === 0 && <span className="px-1 text-gray-500">Sem responsável</span>}
        {selected.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-1.5 rounded-full bg-blue-050 py-0.5 pl-1 pr-2 text-xs font-semibold text-blue-900"
          >
            <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
            {p.full_name.split(" ")[0]}
            {!disabled && (
              <X
                className="h-3 w-3 text-blue-900/60 hover:text-blue-900"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(p.id);
                }}
              />
            )}
          </span>
        ))}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-500" />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-[var(--shadow-lg)]">
          {profiles.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => toggle(p.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-gray-050",
                  checked && "bg-yellow-050"
                )}
              >
                <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
                <span className="flex-1 text-blue-900">{p.full_name}</span>
                {checked && <span className="text-xs font-bold text-yellow-600">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
