"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Anima o número de 0 (ou do valor anterior) até o alvo. */
function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target) {
      fromRef.current = target;
      const id = window.requestAnimationFrame(() => setValue(target));
      return () => window.cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = window.requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  color,
  index = 0,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint?: string;
  /** cor de destaque (hex) */
  color: string;
  index?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const shown = useCountUp(value);
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      style={{ animationDelay: `${index * 60}ms`, borderColor: active ? color : undefined }}
      className={cn(
        "ast-fade-up group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-white p-3.5 text-left shadow-[var(--shadow-sm)] transition-all duration-200",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:translate-y-0",
        active ? "border-2" : "border-gray-200"
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden />
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block font-display text-2xl font-bold text-blue-900 tabular-nums">{shown}</span>
        <span className="block truncate text-xs font-semibold text-gray-500">{label}</span>
        {hint && <span className="block truncate text-[11px] text-gray-400">{hint}</span>}
      </span>
    </Comp>
  );
}
