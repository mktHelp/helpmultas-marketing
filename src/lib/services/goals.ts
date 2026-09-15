import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentType, Goal } from "@/types/database";

const GOAL_SELECT = `
  *,
  area:areas(id, name, color),
  user:profiles!goals_user_id_fkey(id, full_name, avatar_url)
`;

export async function listGoals(supabase: SupabaseClient, activeOnly = true) {
  let query = supabase.from("goals").select(GOAL_SELECT).order("period_start", { ascending: false });
  if (activeOnly) {
    const today = new Date().toISOString().slice(0, 10);
    query = query.lte("period_start", today).gte("period_end", today);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as Goal[]) || [];
}

export interface CreateGoalInput {
  scope: Goal["scope"];
  area_id?: string | null;
  user_id?: string | null;
  metric: Goal["metric"];
  content_type?: ContentType | null;
  target_value: number;
  period_start: string;
  period_end: string;
  created_by: string;
}

export async function createGoal(supabase: SupabaseClient, input: CreateGoalInput) {
  const { data, error } = await supabase.from("goals").insert(input).select(GOAL_SELECT).single();
  if (error) throw error;
  return data as unknown as Goal;
}

export async function updateGoal(supabase: SupabaseClient, id: string, patch: Partial<CreateGoalInput>) {
  const { data, error } = await supabase.from("goals").update(patch).eq("id", id).select(GOAL_SELECT).single();
  if (error) throw error;
  return data as unknown as Goal;
}

export async function deleteGoal(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
