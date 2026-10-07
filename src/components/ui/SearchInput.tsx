"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Campo de busca único do sistema: pílula, ícone à esquerda e botão de limpar. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
  onEnter,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative min-w-[200px] flex-1 sm:max-w-sm", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onEnter ? (e) => e.key === "Enter" && onEnter() : undefined}
        placeholder={placeholder}
        aria-label={placeholder}
        // 16px no celular evita o zoom automático do iOS ao focar
        className="h-11 w-full appearance-none rounded-full border border-gray-200 bg-white pl-10 pr-9 text-base text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:shadow-[var(--shadow-focus)] sm:h-10 sm:text-sm [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-blue-900">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
