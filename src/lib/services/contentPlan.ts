import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContentPlanMonth, ContentPlanPost, ContentPlanStory, PlanAccount, PlanStoryMoment,
} from "@/types/database";
import { createTask } from "./tasks";
import { ACCOUNT_PROJECT, MOMENT_ORDER, PLAN_CONTENT_TYPE, scriptToText } from "../contentPlan";
import { dateInputToISO } from "../utils";

export type PostInput = Omit<ContentPlanPost, "id" | "created_at" | "updated_at">;

export async function listPlanPosts(supabase: SupabaseClient, from: string, to: string, account?: PlanAccount | "") {
  let q = supabase
    .from("content_plan_posts")
    .select("*")
    .gte("publish_date", from)
    .lte("publish_date", to)
    .order("publish_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (account) q = q.eq("account", account);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ContentPlanPost[];
}

export async function savePlanPost(supabase: SupabaseClient, post: Partial<ContentPlanPost> & { id?: string }) {
  const { id, created_at, updated_at, ...fields } = post;
  void created_at;
  void updated_at;
  if (id) {
    const { data, error } = await supabase.from("content_plan_posts").update(fields).eq("id", id).select().single();
    if (error) throw error;
    return data as ContentPlanPost;
  }
  const { data, error } = await supabase.from("content_plan_posts").insert(fields).select().single();
  if (error) throw error;
  return data as ContentPlanPost;
}

export async function deletePlanPost(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("content_plan_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function listPlanStories(supabase: SupabaseClient, from: string, to: string, account?: PlanAccount | "") {
  let q = supabase
    .from("content_plan_stories")
    .select("*")
    .gte("story_date", from)
    .lte("story_date", to)
    .order("story_date", { ascending: true })
    .order("sort_order", { ascending: true });
  if (account) q = q.eq("account", account);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ContentPlanStory[];
}

export async function addPlanStories(
  supabase: SupabaseClient,
  rows: { account: PlanAccount; story_date: string; moment: PlanStoryMoment; text?: string }[]
) {
  const payload = rows.map((r) => ({ ...r, text: r.text ?? "", sort_order: MOMENT_ORDER.indexOf(r.moment) }));
  const { data, error } = await supabase.from("content_plan_stories").insert(payload).select();
  if (error) throw error;
  return (data ?? []) as ContentPlanStory[];
}

export async function updatePlanStory(supabase: SupabaseClient, id: string, patch: Partial<ContentPlanStory>) {
  const { error } = await supabase.from("content_plan_stories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePlanStory(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("content_plan_stories").delete().eq("id", id);
  if (error) throw error;
}

export async function listPlanMonths(supabase: SupabaseClient, from: string, to: string, account?: PlanAccount | "") {
  let q = supabase.from("content_plan_months").select("*").gte("month", from).lte("month", to);
  if (account) q = q.eq("account", account);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ContentPlanMonth[];
}

export async function savePlanMonth(
  supabase: SupabaseClient,
  m: { account: PlanAccount; month: string; summary: string | null; story_rules: string | null }
) {
  const { error } = await supabase
    .from("content_plan_months")
    .upsert({ ...m, updated_at: new Date().toISOString() }, { onConflict: "account,month" });
  if (error) throw error;
}

/**
 * Manda o post do planejamento para a produção: cria a tarefa no quadro (Produção), com prazo na data de
 * publicação, projeto do perfil e o roteiro na descrição, e liga os dois.
 */
export async function sendPostToProduction(supabase: SupabaseClient, post: ContentPlanPost, userId: string) {
  const { data: projects } = await supabase.from("projects").select("id, name").eq("is_archived", false);
  const project = (projects ?? []).find((p: { id: string; name: string }) => p.name.toLowerCase().includes(ACCOUNT_PROJECT[post.account]));
  const task = await createTask(supabase, {
    title: post.theme,
    description: post.no_script ? post.recording_notes ?? "" : scriptToText(post),
    project_id: project?.id ?? null,
    content_type: PLAN_CONTENT_TYPE[post.format],
    created_by: userId,
    due_date: dateInputToISO(post.publish_date),
    priority: "media",
  });
  await savePlanPost(supabase, { id: post.id, task_id: task.id });
  return task;
}
