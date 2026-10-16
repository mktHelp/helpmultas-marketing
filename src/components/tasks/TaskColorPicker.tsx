"use client";

import { Check, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export const TASK_COLORS = [
  { value: "#c23b3b", label: "Vermelho" },
  { value: "#e07a1f", label: "Laranja" },
  { value: "#e0a900", label: "Amarelo" },
  { value: "#2f8f5b", label: "Verde" },
  { value: "#1a9a9a", label: "Turquesa" },
  { value: "#2f6fb5", label: "Azul" },
  { value: "#6b4bb8", label: "Roxo" },
  { value: "#c0408f", label: "Rosa" },
  { value: "#7c8e98", label: "Cinza" },
];

/** Paleta de cores da tarefa. Clicar na cor ativa (ou no "sem cor") volta para a cor da etapa. */
export function TaskColorPicker({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-5 w-5" : "h-7 w-7";
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Cor da tarefa">
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        aria-label="Sem cor (usa a cor da etapa)"
        title="Sem cor"
        disabled={disabled}
        onClick={() => onChange(null)}
        className={cn(
          dim,
          "flex items-center justify-center rounded-full border text-gray-400 transition-all active:scale-90 disabled:opacity-60",
          !value ? "border-blue-900 text-blue-900" : "border-gray-300 hover:border-gray-400"
        )}
      >
        <Ban className="h-3 w-3" />
      </button>
      {TASK_COLORS.map((c) => {
        const active = value?.toLowerCase() === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.label}
            title={c.label}
            disabled={disabled}
            onClick={() => onChange(active ? null : c.value)}
            className={cn(dim, "flex items-center justify-center rounded-full text-white shadow-sm transition-all hover:scale-110 active:scale-90 disabled:opacity-60", active && "ring-2 ring-blue-900 ring-offset-2")}
            style={{ backgroundColor: c.value }}
          >
            {active && <Check className="h-3 w-3" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
