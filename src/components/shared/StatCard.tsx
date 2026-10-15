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
      style={{ animationDelay: `${index * 50}ms` }}
      className={cn(
        "hm-card ast-fade-up group relative flex min-h-[92px] flex-col justify-between overflow-hidden rounded-2xl p-4 text-left shadow-[var(--shadow-sm)] transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-[var(--shadow-md)]"
      )}
    >
      {/* ícone no encaixe com bordas invertidas */}
      <span className="ic-slot">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[11px] transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: active ? color : `${color}1f`, color: active ? "#fff" : color }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </span>
      <span className="block truncate pr-11 text-xs font-semibold text-gray-500">{label}</span>
      <span className="mt-1 block font-display text-[26px] font-semibold leading-none tracking-tight text-blue-900 tabular-nums">{shown}</span>
      {hint && <span className="mt-1.5 block truncate text-[11px] text-gray-400">{hint}</span>}
      {/* filtro ativo: traço na base, na cor do indicador */}
      <span
        className={cn("absolute inset-x-4 bottom-0 h-[3px] rounded-t-full transition-opacity", active ? "opacity-100" : "opacity-0")}
        style={{ backgroundColor: color }}
        aria-hidden
      />
    </Comp>
  );
}
