"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Listbox, type ListboxOption } from "./Listbox";
import { cn } from "@/lib/utils";

// Células editáveis das tabelas (padrão ERP): parecem texto, viram campo ao clicar.
// Enter ou sair do campo salva, Esc cancela. `onSave` pode ser assíncrono: enquanto
// salva aparece um indicador, e se der erro o valor volta ao original.

type Saver<T> = (value: T) => void | Promise<void>;

function useSaving() {
  const [saving, setSaving] = useState(false);
  async function run(fn: () => void | Promise<void>) {
    setSaving(true);
    try {
      await fn();
    } finally {
      setSaving(false);
    }
  }
  return { saving, run };
}

function Spinner() {
  return <Loader2 className="ml-1 inline h-3 w-3 shrink-0 animate-spin text-gray-400" aria-label="Salvando" />;
}

/** Texto livre (ou número com `type="number"`). */
export function EditableText({
  value,
  onSave,
  placeholder = "—",
  type = "text",
  format,
  className,
  inputClassName,
  disabled,
  ariaLabel,
}: {
  value: string;
  onSave: Saver<string>;
  placeholder?: string;
  type?: "text" | "number";
  /** como mostrar o valor fora da edição */
  format?: (value: string) => React.ReactNode;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const { saving, run } = useSaving();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next === value.trim()) return;
    run(async () => {
      try {
        await onSave(next);
      } catch {
        setDraft(value);
      }
    });
  }

  if (disabled) return <span className={cn("block truncate", className)}>{value ? (format ? format(value) : value) : <span className="text-gray-400">{placeholder}</span>}</span>;

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        data-editing="true"
        className={cn("cell-edit bg-white text-[13px] text-blue-900", type === "number" && "text-right tabular-nums", inputClassName)}
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} aria-label={ariaLabel ? `Editar ${ariaLabel}` : "Editar"} title="Clique para editar" className={cn("cell-edit truncate", type === "number" && "text-right tabular-nums", className)}>
      {draft ? (format ? format(draft) : draft) : <span className="text-gray-400">{placeholder}</span>}
      {saving && <Spinner />}
    </button>
  );
}

/** Data (AAAA-MM-DD). `display` formata para leitura. */
export function EditableDate({
  value,
  onSave,
  display,
  placeholder = "Sem data",
  className,
  ariaLabel,
}: {
  value: string | null;
  onSave: Saver<string | null>;
  display?: (value: string) => React.ReactNode;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const { saving, run } = useSaving();
  const current = value ? value.slice(0, 10) : "";

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={current}
        aria-label={ariaLabel}
        data-editing="true"
        onBlur={(e) => {
          setEditing(false);
          const next = e.target.value || null;
          if (next !== (current || null)) run(() => onSave(next));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="cell-edit bg-white text-[13px] text-blue-900"
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} aria-label={ariaLabel ? `Editar ${ariaLabel}` : "Editar data"} title="Clique para editar" className={cn("cell-edit whitespace-nowrap", className)}>
      {current ? (display ? display(current) : current) : <span className="text-gray-400">{placeholder}</span>}
      {saving && <Spinner />}
    </button>
  );
}

/** Lista de opções (com cor opcional, mostrada como ponto + texto colorido). */
export function EditableSelect({
  value,
  options,
  onSave,
  ariaLabel,
  className,
}: {
  value: string;
  options: ListboxOption[];
  onSave: Saver<string>;
  ariaLabel?: string;
  className?: string;
}) {
  const [current, setCurrent] = useState(value);
  const { saving, run } = useSaving();
  useEffect(() => setCurrent(value), [value]);

  return (
    <div className="flex items-center">
      <Listbox
        variant="cell"
        options={options}
        value={[current]}
        ariaLabel={ariaLabel}
        className={className}
        wrapperClassName="min-w-0"
        onChange={([next]) => {
          if (next === current) return;
          const prev = current;
          setCurrent(next);
          run(async () => {
            try {
              await onSave(next);
            } catch {
              setCurrent(prev);
            }
          });
        }}
      />
      {saving && <Spinner />}
    </div>
  );
}
