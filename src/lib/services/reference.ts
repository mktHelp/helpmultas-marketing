import type { SupabaseClient } from "@supabase/supabase-js";
import type { Area, Category, Tag, TaskStatusRow, TaskTemplate } from "@/types/database";

// ------------------------- Areas -------------------------
export async function listAreas(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("areas").select("*").order("sort_order");
  if (error) throw error;
  return data as Area[];
}

export async function createArea(supabase: SupabaseClient, name: string, color = "#243746") {
  const { data, error } = await supabase.from("areas").insert({ name, color }).select().single();
  if (error) throw error;
  return data as Area;
}

export async function updateArea(supabase: SupabaseClient, id: string, patch: Partial<Pick<Area, "name" | "color">>) {
  const { data, error } = await supabase.from("areas").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Area;
}

export async function deleteArea(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("areas").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------- Categories -------------------------
export async function listCategories(supabase: SupabaseClient, areaId?: string) {
  let query = supabase.from("categories").select("*").order("name");
  if (areaId) query = query.eq("area_id", areaId);
  const { data, error } = await query;
  if (error) throw error;
  return data as Category[];
}

export async function createCategory(supabase: SupabaseClient, name: string, areaId: string) {
  const { data, error } = await supabase.from("categories").insert({ name, area_id: areaId }).select().single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(supabase: SupabaseClient, id: string, patch: Partial<Pick<Category, "name" | "area_id">>) {
  const { data, error } = await supabase.from("categories").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------- Tags -------------------------
export async function listTags(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("tags").select("*").order("name");
  if (error) throw error;
  return data as Tag[];
}

export async function createTag(supabase: SupabaseClient, name: string, color = "#4a6a80") {
  const { data, error } = await supabase.from("tags").insert({ name, color }).select().single();
  if (error) throw error;
  return data as Tag;
}

export async function updateTag(supabase: SupabaseClient, id: string, patch: Partial<Pick<Tag, "name" | "color">>) {
  const { data, error } = await supabase.from("tags").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Tag;
}

export async function deleteTag(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------- Task templates -------------------------
export async function listTemplates(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("task_templates").select("*").order("name");
  if (error) throw error;
  return data as TaskTemplate[];
}

// ------------------------- Task statuses ("etapas") -------------------------
export async function listTaskStatuses(supabase: SupabaseClient, onlyActive = false) {
  let query = supabase.from("task_statuses").select("*").order("sort_order");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data as TaskStatusRow[];
}

function slugify(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function createTaskStatus(
  supabase: SupabaseClient,
  input: { label: string; color?: string; is_done?: boolean; is_cancelled?: boolean }
) {
  const { data: existing } = await supabase.from("task_statuses").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
  let key = slugify(input.label) || `etapa_${Date.now()}`;

  const { data: clash } = await supabase.from("task_statuses").select("key").eq("key", key);
  if (clash && clash.length > 0) key = `${key}_${Date.now()}`;

  const { data, error } = await supabase
    .from("task_statuses")
    .insert({
      key,
      label: input.label,
      color: input.color || "#7c8e98",
      sort_order: nextOrder,
      is_done: input.is_done ?? false,
      is_cancelled: input.is_cancelled ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskStatusRow;
}

export async function updateTaskStatus(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<TaskStatusRow, "label" | "color" | "is_active" | "is_done" | "is_cancelled">>
) {
  const { data, error } = await supabase.from("task_statuses").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as TaskStatusRow;
}

export async function setDefaultTaskStatus(supabase: SupabaseClient, id: string) {
  await supabase.from("task_statuses").update({ is_default: false }).neq("id", id);
  const { data, error } = await supabase.from("task_statuses").update({ is_default: true }).eq("id", id).select().single();
  if (error) throw error;
  return data as TaskStatusRow;
}

export async function reorderTaskStatuses(supabase: SupabaseClient, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("task_statuses").update({ sort_order: index }).eq("id", id))
  );
}

export async function deleteTaskStatus(supabase: SupabaseClient, status: TaskStatusRow) {
  if (status.is_default) {
    throw new Error("Esta é a etapa padrão de novas tarefas. Defina outra etapa como padrão antes de excluir esta.");
  }

  const { count, error: countErr } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", status.key);
  if (countErr) throw countErr;
  if (count && count > 0) {
    throw new Error(`Existem ${count} tarefa(s) usando esta etapa. Desative-a em vez de excluir, ou mova as tarefas primeiro.`);
  }

  const { error } = await supabase.from("task_statuses").delete().eq("id", status.id);
  if (error) throw error;
}
