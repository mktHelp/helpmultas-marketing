"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { createTag, deleteTag, listTags, updateTag } from "@/lib/services/reference";
import type { Tag as TagType } from "@/types/database";

const COLORS = ["#243746", "#4a6a80", "#e0a900", "#c23b3b", "#2f8f5b", "#7c8e98"];

export function TagsSettings() {
  const supabase = createClient();
  const [tags, setTags] = useState<TagType[]>([]);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<TagType | null>(null);

  async function load() {
    setTags(await listTags(supabase));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    if (!name.trim()) return;
    await createTag(supabase, name.trim(), COLORS[tags.length % COLORS.length]);
    setName("");
    toast.success("Tag criada");
    load();
  }

  async function rename(tag: TagType, newName: string) {
    if (!newName.trim() || newName === tag.name) return;
    await updateTag(supabase, tag.id, { name: newName });
    load();
  }

  async function recolor(tag: TagType, color: string) {
    await updateTag(supabase, tag.id, { color });
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteTag(supabase, toDelete.id);
    toast.success("Tag excluída");
    setToDelete(null);
    load();
  }

  return (
    <div className="max-w-xl">
      <h3 className="mb-3 font-display text-sm font-bold text-blue-900">Tags</h3>
      <div className="mb-3 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nova tag" />
        <Button size="icon" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1.5">
        {tags.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => recolor(t, c)}
                  className="h-4 w-4 rounded-full border-2"
                  style={{ backgroundColor: c, borderColor: t.color === c ? "#243746" : "transparent" }}
                />
              ))}
            </div>
            <input
              defaultValue={t.name}
              onBlur={(e) => rename(t, e.target.value)}
              className="flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-blue-900 hover:border-gray-200 focus:border-gray-200 focus:outline-none"
            />
            <button onClick={() => setToDelete(t)} className="text-gray-400 hover:text-[color:var(--color-danger)]">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir tag"
        description={`Tem certeza que deseja excluir a tag "${toDelete?.name}"?`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
