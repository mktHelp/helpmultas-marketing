"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ListChecks, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addChecklistItem, deleteChecklistItem, toggleChecklistItem } from "@/lib/services/tasks";
import { cn } from "@/lib/utils";
import type { TaskChecklistItem } from "@/types/database";

export function ChecklistPanel({
  taskId,
  items,
  onChange,
  disabled,
}: {
  taskId: string;
  items: TaskChecklistItem[];
  onChange: (items: TaskChecklistItem[]) => void;
  disabled?: boolean;
}) {
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);
  const supabase = createClient();
  const done = items.filter((i) => i.completed).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  const complete = items.length > 0 && done === items.length;

  async function add() {
    const title = newItem.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const item = await addChecklistItem(supabase, taskId, title, items.length);
      onChange([...items, item]);
      setNewItem("");
    } catch {
      toast.error("Não foi possível adicionar o item");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(item: TaskChecklistItem) {
    try {
      const updated = await toggleChecklistItem(supabase, item.id, !item.completed);
      onChange(items.map((i) => (i.id === item.id ? updated : i)));
    } catch {
      toast.error("Não foi possível atualizar o item");
    }
  }

  async function remove(id: string) {
    try {
      await deleteChecklistItem(supabase, id);
      onChange(items.filter((i) => i.id !== id));
    } catch {
      toast.error("Não foi possível remover o item");
    }
  }

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
            <span className={cn(complete ? "text-[color:var(--color-success)]" : "text-gray-500")}>
              {complete ? "Tudo concluído! 🎉" : `${done} de ${items.length} concluídas`}
            </span>
            <span className="tabular-nums text-blue-900">{percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn("h-2 rounded-full transition-all duration-500", complete ? "bg-[color:var(--color-success)]" : "bg-gradient-to-r from-yellow-500 to-amber-400")}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="mb-3 flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-gray-200 py-6 text-center">
          <ListChecks className="h-6 w-6 text-gray-300" />
          <p className="text-sm text-gray-400">Quebre a tarefa em passos pequenos.</p>
        </div>
      )}

      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={item.id}
            style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
            className="kb-card-in group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-gray-050"
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggle(item)}
              aria-pressed={item.completed}
              aria-label={item.completed ? "Desmarcar item" : "Concluir item"}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all active:scale-90 disabled:cursor-not-allowed",
                item.completed ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white" : "border-gray-300 text-transparent hover:border-yellow-500"
              )}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
            <span className={cn("min-w-0 flex-1 break-words text-sm transition-colors", item.completed ? "text-gray-400 line-through" : "text-blue-900")}>
              {item.title}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Remover item"
                className="rounded-full p-1.5 text-gray-400 opacity-100 transition-opacity hover:bg-white hover:text-[color:var(--color-danger)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {!disabled && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            placeholder="Adicionar item e apertar Enter…"
            aria-label="Novo item do checklist"
            className="h-11 min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-050 px-4 text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:bg-white focus:shadow-[var(--shadow-focus)] sm:h-10"
            style={{ fontSize: 16 }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!newItem.trim() || adding}
            aria-label="Adicionar item"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yellow-500 text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-90 disabled:opacity-40 sm:h-10 sm:w-10"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
