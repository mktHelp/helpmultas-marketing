import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentIdea, ContentIdeaRun, ContentRadarSettings, ContentType } from "@/types/database";
import { createTask } from "./tasks";
import { createTeleprompterScript } from "./teleprompterScripts";

export const ACCOUNT_LABEL: Record<ContentIdea["account"], string> = {
  franchising: "@helpmultasfranchising",
  roberson: "@roberson.alvarenga",
};

export async function listContentIdeas(supabase: SupabaseClient, days = 7) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("content_ideas")
    .select("*")
    .gte("batch_date", since)
    .order("batch_date", { ascending: false })
    .order("period", { ascending: false })
    .order("score", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data as ContentIdea[];
}

export async function getLatestRun(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("content_idea_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ContentIdeaRun | null;
}

/** Dispara o Radar de Pauta pelo botão. Se já houver uma execução, devolve ela (409). */
export async function startRun(): Promise<{ run: ContentIdeaRun | null; error?: string; alreadyRunning?: boolean }> {
  const res = await fetch("/api/pautas/run", { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409) return { run: body.run ?? null, error: body.error, alreadyRunning: true };
  if (!res.ok) return { run: null, error: body.error || "Não foi possível iniciar." };
  return { run: body.run };
}

/** Notificações de pautas ainda não lidas (bolinha da aba na sidebar). */
export async function unreadIdeasCount(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "content_ideas")
    .is("read_at", null);
  if (error) throw error;
  return count || 0;
}

export async function markIdeasSeen(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("type", "content_ideas")
    .is("read_at", null);
  if (error) throw error;
  window.dispatchEvent(new Event("content-ideas-seen"));
}

async function decide(supabase: SupabaseClient, id: string, userId: string, patch: Partial<ContentIdea>) {
  const { data, error } = await supabase
    .from("content_ideas")
    .update({ ...patch, decided_by: userId, decided_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ContentIdea;
}

export function discardIdea(supabase: SupabaseClient, id: string, userId: string) {
  return decide(supabase, id, userId, { status: "descartada" });
}

export function reopenIdea(supabase: SupabaseClient, id: string, userId: string) {
  return decide(supabase, id, userId, { status: "nova", task_id: null });
}

/** Aprova a pauta e cria a tarefa com briefing, roteiro e legenda já preenchidos. */
export async function approveIdeaAsTask(supabase: SupabaseClient, idea: ContentIdea, userId: string, opts: { dueDate?: string | null; assigneeIds?: string[] } = {}) {
  const fmt: ContentType = idea.format === "stories" ? "stories" : idea.format;
  const briefing = [
    `Conta: ${ACCOUNT_LABEL[idea.account]}`,
    idea.hook && `Gancho: ${idea.hook}`,
    idea.why && `Por que deve funcionar: ${idea.why}`,
    idea.needs_check && `⚠️ Conferir antes de publicar: ${idea.check_note ?? "valores e regras citados"}`,
    idea.source_url && `Fonte: ${idea.source_title ?? idea.source_name ?? ""} — ${idea.source_url}`,
    idea.reference_permalink && `Referência: ${idea.reference_permalink}${idea.reference_note ? ` (${idea.reference_note})` : ""}`,
  ].filter(Boolean).join("\n");
  const task = await createTask(supabase, { title: idea.title, content_type: fmt, created_by: userId, status: "planejamento", due_date: opts.dueDate ?? null, assigneeIds: opts.assigneeIds });
  const { error } = await supabase
    .from("tasks")
    .update({ briefing, script_notes: idea.script, caption: [idea.caption, idea.cta].filter(Boolean).join("\n\n") || null })
    .eq("id", task.id);
  if (error) throw error;
  return decide(supabase, idea.id, userId, { status: "aprovada", task_id: task.id });
}

function textToHtml(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return "<p>" + esc.split(/\n{2,}/).map((p) => p.replace(/\n/g, "<br>")).join("</p><p>") + "</p>";
}

export async function sendIdeaToTeleprompter(supabase: SupabaseClient, idea: ContentIdea, userId: string) {
  const content = [idea.hook, idea.script, idea.cta].filter(Boolean).join("\n\n");
  const script = await createTeleprompterScript(supabase, userId, {
    title: idea.title,
    content,
    content_html: textToHtml(content),
    folder_id: null,
    record_date: null,
  });
  return decide(supabase, idea.id, userId, { status: "aprovada", teleprompter_script_id: script.id });
}

/** Pede à IA outra versão da pauta (novo gancho e ângulo) e salva como uma pauta nova, logo ao lado. */
export async function requestIdeaVariation(ideaId: string): Promise<ContentIdea> {
  const res = await fetch("/api/pautas/variation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ideaId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Não foi possível gerar a variação.");
  return body.idea as ContentIdea;
}

/** Execuções do Radar de Pauta dos últimos dias (painel de uso da IA). */
export async function listRecentRuns(supabase: SupabaseClient, days = 30) {
  const { data, error } = await supabase
    .from("content_idea_runs")
    .select("*")
    .gte("started_at", new Date(Date.now() - days * 864e5).toISOString())
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data as ContentIdeaRun[];
}

/** Modelos sugeridos no seletor (preços em US$ por 1 milhão de tokens; confira em openai.com/api/pricing). */
export const RADAR_MODELS = [
  { id: "gpt-5-nano", label: "GPT-5 nano", hint: "Mais barato, texto mais simples", priceIn: 0.05, priceOut: 0.4 },
  { id: "gpt-5-mini", label: "GPT-5 mini", hint: "Equilíbrio entre custo e qualidade", priceIn: 0.25, priceOut: 2 },
  { id: "gpt-5", label: "GPT-5", hint: "Melhor qualidade, custo maior", priceIn: 1.25, priceOut: 10 },
];

export const RADAR_EFFORTS = [
  { id: "padrao", label: "Padrão do modelo", hint: "Deixa a OpenAI decidir" },
  { id: "minimal", label: "Mínimo", hint: "Mais rápido e barato, pouco raciocínio" },
  { id: "low", label: "Baixo", hint: "Raciocínio leve" },
  { id: "medium", label: "Médio", hint: "Bom para a maioria dos casos" },
  { id: "high", label: "Alto", hint: "Mais lento e caro, checa mais" },
];

export async function getRadarSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("content_radar_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data as ContentRadarSettings | null;
}

export async function saveRadarSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: Pick<ContentRadarSettings, "model" | "reasoning_effort" | "qtd_pautas" | "price_in_usd_1m" | "price_out_usd_1m">
) {
  const { data, error } = await supabase
    .from("content_radar_settings")
    .upsert({ id: 1, ...patch, updated_by: userId, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as ContentRadarSettings;
}
