"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabase/client";
import { createArea, createCategory, listAreas, listCategories } from "@/lib/services/reference";
import type { Area, Category } from "@/types/database";

export function AreasSettings() {
  const supabase = createClient();
  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newArea, setNewArea] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [categoryArea, setCategoryArea] = useState("");

  async function load() {
    const [a, c] = await Promise.all([listAreas(supabase), listCategories(supabase)]);
    setAreas(a);
    setCategories(c);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addArea() {
    if (!newArea.trim()) return;
    await createArea(supabase, newArea.trim());
    setNewArea("");
    toast.success("Área criada");
    load();
  }

  async function addCategory() {
    if (!newCategory.trim() || !categoryArea) return;
    await createCategory(supabase, newCategory.trim(), categoryArea);
    setNewCategory("");
    toast.success("Categoria criada");
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <h3 className="mb-3 font-display text-sm font-bold text-blue-900">Áreas</h3>
        <div className="mb-3 flex gap-2">
          <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Nova área" />
          <Button size="icon" onClick={addArea}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-1.5">
          {areas.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />
              <span className="text-sm font-semibold text-blue-900">{a.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display text-sm font-bold text-blue-900">Categorias</h3>
        <div className="mb-3 flex gap-2">
          <Select className="w-32" value={categoryArea} onChange={(e) => setCategoryArea(e.target.value)}>
            <option value="">Área</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nova categoria" />
          <Button size="icon" onClick={addCategory}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-1.5">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
              <span className="font-semibold text-blue-900">{c.name}</span>
              <span className="text-xs text-gray-400">{areas.find((a) => a.id === c.area_id)?.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
