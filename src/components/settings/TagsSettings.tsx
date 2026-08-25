"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { createClient } from "@/lib/supabase/client";
import { createTag, listTags } from "@/lib/services/reference";
import type { Tag as TagType } from "@/types/database";

const COLORS = ["#243746", "#4a6a80", "#e0a900", "#c23b3b", "#2f8f5b", "#7c8e98"];

export function TagsSettings() {
  const supabase = createClient();
  const [tags, setTags] = useState<TagType[]>([]);
  const [name, setName] = useState("");

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

  return (
    <div className="max-w-md">
      <h3 className="mb-3 font-display text-sm font-bold text-blue-900">Tags</h3>
      <div className="mb-3 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova tag" />
        <Button size="icon" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => <Tag key={t.id} label={t.name} color={t.color} />)}
      </div>
    </div>
  );
}
