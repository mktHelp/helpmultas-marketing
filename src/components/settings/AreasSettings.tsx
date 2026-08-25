"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import {
  createArea, createCategory, deleteArea, deleteCategory, listAreas, listCategories, updateArea, updateCategory,
} from "@/lib/services/reference";
import type { Area, Category } from "@/types/database";

const COLORS = ["#243746", "#4a6a80", "#fcbf00", "#e0a900", "#375367", "#2f8f5b", "#c23b3b", "#7c8e98"];

export function AreasSettings() {
  const supabase = createClient();
  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newArea, setNewArea] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [categoryArea, setCategoryArea] = useState("");
  const [deleteAreaTarget, setDeleteAreaTarget] = useState<Area | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null);

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

  async function renameArea(area: Area, name: string) {
    if (!name.trim() || name === area.name) return;
    await updateArea(supabase, area.id, { name });
    load();
  }

  async function recolorArea(area: Area, color: string) {
    await updateArea(supabase, area.id, { color });
    load();
  }

  async function confirmDeleteArea() {
    if (!deleteAreaTarget) return;
    await deleteArea(supabase, deleteAreaTarget.id);
    toast.success("Área excluída");
    setDeleteAreaTarget(null);
    load();
  }

  async function addCategory() {
    if (!newCategory.trim() || !categoryArea) return;
    await createCategory(supabase, newCategory.trim(), categoryArea);
    setNewCategory("");
    toast.success("Categoria criada");
    load();
  }

  async function renameCategory(category: Category, name: string) {
    if (!name.trim() || name === category.name) return;
    await updateCategory(supabase, category.id, { name });
    load();
  }

  async function confirmDeleteCategory() {
    if (!deleteCategoryTarget) return;
    await deleteCategory(supabase, deleteCategoryTarget.id);
    toast.success("Categoria excluída");
    setDeleteCategoryTarget(null);
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <h3 className="mb-3 font-display text-sm font-bold text-blue-900">Áreas</h3>
        <div className="mb-3 flex gap-2">
          <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addArea()} placeholder="Nova área" />
          <Button size="icon" onClick={addArea}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-1.5">
          {areas.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
              <div className="flex gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => recolorArea(a, c)}
                    className="h-4 w-4 rounded-full border-2"
                    style={{ backgroundColor: c, borderColor: a.color === c ? "#243746" : "transparent" }}
                  />
                ))}
              </div>
              <input
                defaultValue={a.name}
                onBlur={(e) => renameArea(a, e.target.value)}
                className="flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-blue-900 hover:border-gray-200 focus:border-gray-200 focus:outline-none"
              />
              <button onClick={() => setDeleteAreaTarget(a)} className="text-gray-400 hover:text-[color:var(--color-danger)]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
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
          <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="Nova categoria" />
          <Button size="icon" onClick={addCategory}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-1.5">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm">
              <input
                defaultValue={c.name}
                onBlur={(e) => renameCategory(c, e.target.value)}
                className="flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-semibold text-blue-900 hover:border-gray-200 focus:border-gray-200 focus:outline-none"
              />
              <span className="shrink-0 text-xs text-gray-400">{areas.find((a) => a.id === c.area_id)?.name}</span>
              <button onClick={() => setDeleteCategoryTarget(c)} className="text-gray-400 hover:text-[color:var(--color-danger)]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteAreaTarget}
        onClose={() => setDeleteAreaTarget(null)}
        onConfirm={confirmDeleteArea}
        title="Excluir área"
        description={`Tem certeza que deseja excluir "${deleteAreaTarget?.name}"? Tarefas e categorias vinculadas ficarão sem área.`}
        confirmLabel="Excluir"
        danger
      />
      <ConfirmDialog
        open={!!deleteCategoryTarget}
        onClose={() => setDeleteCategoryTarget(null)}
        onConfirm={confirmDeleteCategory}
        title="Excluir categoria"
        description={`Tem certeza que deseja excluir "${deleteCategoryTarget?.name}"? Tarefas vinculadas ficarão sem categoria.`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
