"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Lista suspensa própria do Hub (substitui o <select> nativo): painel em
// portal (não é cortado por modais/overflow), busca automática em listas
// longas, navegação por teclado e modo de seleção múltipla. Select,
// FilterSelect e MultiSelect são só adaptadores em cima deste componente.

export interface ListboxOption {
  value: string;
  label: string;
  color?: string;
  disabled?: boolean;
}

export interface ListboxProps {
  options: ListboxOption[];
  value: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  /** Texto quando nada está selecionado (modo múltiplo) ou a opção selecionada é a vazia. */
  placeholder?: string;
  /** Modo múltiplo com 2+ itens: "3 campanhas". */
  pluralLabel?: string;
  variant?: "field" | "pill";
  /** Padrão: liga a busca quando há mais de 7 opções. */
  searchable?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  ariaLabel?: string;
  /** Classe do botão. */
  className?: string;
  style?: React.CSSProperties;
  /** Classe do contêiner (largura etc.). */
  wrapperClassName?: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Pos {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function Listbox({
  options, value, onChange, multiple = false, placeholder = "Selecione", pluralLabel = "selecionados", variant = "field",
  searchable, disabled, required, name, id, ariaLabel, className, style, wrapperClassName,
}: ListboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const showSearch = searchable ?? options.length > 7;
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return q ? options.filter((o) => norm(o.label).includes(q)) : options;
  }, [options, query]);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 240), vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    // Abre para cima só quando embaixo não cabe e em cima há mais espaço.
    if (below < 220 && above > below) setPos({ bottom: vh - r.top + 6, left, width, maxHeight: Math.min(380, above) });
    else setPos({ top: r.bottom + 6, left, width, maxHeight: Math.min(380, below) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Foco: na busca (quando há) ou no próprio painel, para o teclado funcionar.
  const placed = pos !== null;
  useEffect(() => {
    if (!open || !placed) return;
    const el = panelRef.current?.querySelector<HTMLInputElement>("input[data-search]") ?? panelRef.current;
    el?.focus({ preventScroll: true });
  }, [open, placed]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openPanel() {
    if (disabled) return;
    setActive(multiple ? 0 : Math.max(0, options.findIndex((o) => o.value === value[0])));
    setQuery("");
    setOpen(true);
  }
  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function pick(opt: ListboxOption) {
    if (opt.disabled) return;
    if (multiple) {
      onChange(value.includes(opt.value) ? value.filter((v) => v !== opt.value) : [...value, opt.value]);
    } else {
      onChange([opt.value]);
      close();
    }
  }

  function onPanelKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const first = options.find((o) => value.includes(o.value));
  const isEmpty = multiple ? value.length === 0 : !first || first.value === "";
  const label = multiple
    ? value.length === 0
      ? placeholder
      : value.length === 1
        ? (first?.label ?? placeholder)
        : `${value.length} ${pluralLabel}`
    : (first?.label ?? placeholder);

  const markable = filtered.filter((o) => !o.disabled && o.value !== "").map((o) => o.value);
  const allOn = markable.length > 0 && markable.every((v) => value.includes(v));

  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            tabIndex={-1}
            role="presentation"
            onKeyDown={onPanelKey}
            style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
            className={cn(
              "dd-pop z-[1000] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[var(--shadow-lg)] outline-none",
              pos.bottom !== undefined && "dd-pop-up"
            )}
          >
            {showSearch && (
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-gray-400" />
                <input
                  data-search
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Buscar..."
                  className="min-w-0 flex-1 bg-transparent text-blue-900 outline-none placeholder:text-gray-400"
                  style={{ fontSize: 16 }}
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="text-gray-400 hover:text-blue-900">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {multiple && (
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 text-xs font-bold">
                <button
                  type="button"
                  disabled={markable.length === 0}
                  onClick={() => onChange(allOn ? value.filter((v) => !markable.includes(v)) : [...new Set([...value, ...markable])])}
                  className="rounded-lg px-1.5 py-1 text-blue-900 transition-colors hover:bg-gray-100 disabled:opacity-40"
                >
                  {allOn ? "Desmarcar todos" : query ? "Marcar os filtrados" : "Marcar todos"}
                </button>
                <button
                  type="button"
                  disabled={value.length === 0}
                  onClick={() => onChange([])}
                  className="rounded-lg px-1.5 py-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-900 disabled:opacity-40"
                >
                  Limpar{value.length > 0 ? ` (${value.length})` : ""}
                </button>
              </div>
            )}

            <div ref={listRef} role="listbox" aria-multiselectable={multiple} id={`${uid}-list`} data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-500">Nada encontrado</p>}
              {filtered.map((opt, i) => {
                const selected = value.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    data-idx={i}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={opt.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(opt)}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm text-blue-900 transition-colors",
                      i === active && "bg-gray-100",
                      selected && !multiple && "font-semibold",
                      opt.disabled && "cursor-not-allowed opacity-40",
                      opt.value === "" && "text-gray-500"
                    )}
                  >
                    {multiple && (
                      <span
                        className={cn(
                          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                          selected ? "border-yellow-500 bg-yellow-500 text-blue-900" : "border-gray-300 bg-white"
                        )}
                      >
                        {selected && <Check className="h-3 w-3" strokeWidth={3.5} />}
                      </span>
                    )}
                    {opt.color && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />}
                    <span className="min-w-0 flex-1 break-words leading-snug">{opt.label}</span>
                    {!multiple && selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-900" strokeWidth={3} />}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={cn("relative", variant === "pill" && "w-full sm:w-60", wrapperClassName)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        style={style}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={cn(
          "flex w-full items-center gap-2 border bg-white text-left text-blue-900 outline-none transition-all",
          variant === "pill" ? "h-11 rounded-full pl-4 pr-3 text-base sm:h-10 sm:text-sm" : "h-10 rounded-[14px] pl-3.5 pr-3 text-sm",
          open ? "border-blue-900 shadow-[var(--shadow-focus)]" : "border-gray-200 hover:border-gray-300 focus-visible:border-blue-900 focus-visible:shadow-[var(--shadow-focus)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", isEmpty && !multiple && "text-gray-500", multiple && value.length > 0 && "font-semibold")}>{label}</span>
        {multiple && value.length > 1 && (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-yellow-500 px-1 text-[11px] font-bold text-blue-900">{value.length}</span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {required && (
        <input tabIndex={-1} aria-hidden required value={value[0] ?? ""} onChange={() => {}} name={name} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" />
      )}
      {!required && name && <input type="hidden" name={name} value={value.join(",")} />}
      {panel}
    </div>
  );
}
