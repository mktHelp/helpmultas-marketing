import type { SupabaseClient } from "@supabase/supabase-js";
import type { Area, Category, Tag, TaskTemplate } from "@/types/database";

export async function listAreas(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("areas").select("*").order("sort_order");
  if (error) throw error;
  return data as Area[];
}

export async function listCategories(supabase: SupabaseClient, areaId?: string) {
  let query = supabase.from("categories").select("*").order("name");
  if (areaId) query = query.eq("area_id", areaId);
  const { data, error } = await query;
  if (error) throw error;
  return data as Category[];
}

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

export async function listTemplates(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("task_templates").select("*").order("name");
  if (error) throw error;
  return data as TaskTemplate[];
}

export async function createArea(supabase: SupabaseClient, name: string, color = "#243746") {
  const { data, error } = await supabase.from("areas").insert({ name, color }).select().single();
  if (error) throw error;
  return data as Area;
}

export async function createCategory(supabase: SupabaseClient, name: string, areaId: string) {
  const { data, error } = await supabase.from("categories").insert({ name, area_id: areaId }).select().single();
  if (error) throw error;
  return data as Category;
}
