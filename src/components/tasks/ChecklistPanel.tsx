"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { addChecklistItem, deleteChecklistItem, toggleChecklistItem } from "@/lib/services/tasks";
import type { TaskChecklistItem } from "@/types/database";

export function ChecklistPanel({
  taskId,
  items,
  onChange,
}: {
  taskId: string;
  items: TaskChecklistItem[];
  onChange: (items: TaskChecklistItem[]) => void;
}) {
  const [newItem, setNewItem] = useState("");
  const supabase = createClient();
  const done = items.filter((i) => i.completed).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;

  async function add() {
    if (!newItem.trim()) return;
    const item = await addChecklistItem(supabase, taskId, newItem.trim(), items.length);
    onChange([...items, item]);
    setNewItem("");
  }

  async function toggle(item: TaskChecklistItem) {
    const updated = await toggleChecklistItem(supabase, item.id, !item.completed);
    onChange(items.map((i) => (i.id === item.id ? updated : i)));
  }

  async function remove(id: string) {
    await deleteChecklistItem(supabase, id);
    onChange(items.filter((i) => i.id !== id));
  }

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>{done}/{items.length} concluídas</span>
            <span>{percent}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full bg-yellow-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-050">
            <Checkbox checked={item.completed} onChange={() => toggle(item)} />
            <span className={`flex-1 text-sm ${item.completed ? "text-gray-400 line-through" : "text-blue-900"}`}>
              {item.title}
            </span>
            <button onClick={() => remove(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[color:var(--color-danger)]">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Adicionar item..."
          className="h-9"
        />
        <button onClick={add} className="rounded-lg bg-gray-100 p-2 text-gray-700 hover:bg-gray-200">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
