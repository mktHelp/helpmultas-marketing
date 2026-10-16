import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiCost } from "@/lib/aiPricing";

export type AiUsageSource = "helpinho" | "teleprompter" | "pauta_variacao" | "expansao_categoria";

/** Formato que o nó "Medir Uso" do n8n devolve junto com a resposta. */
interface WebhookUsage {
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  estimated?: boolean;
  tool_calls?: number;
}

/**
 * Registra uma chamada de IA em ai_usage_events. Nunca derruba a rota: erros de
 * gravação só vão para o log. `data` é a resposta do webhook (pode trazer `usage`).
 */
export async function logAiUsage(opts: {
  source: AiUsageSource;
  userId: string | null;
  startedAt: number;
  data?: unknown;
  ok?: boolean;
  error?: string | null;
  conversationId?: string | null;
}) {
  try {
    const usage = ((opts.data as { usage?: WebhookUsage } | null)?.usage ?? {}) as WebhookUsage;
    const prompt = Number(usage.prompt_tokens) || 0;
    const completion = Number(usage.completion_tokens) || 0;
    const model = typeof usage.model === "string" ? usage.model : null;
    const { error } = await createAdminClient()
      .from("ai_usage_events")
      .insert({
        source: opts.source,
        user_id: opts.userId,
        conversation_id: opts.conversationId ?? null,
        model,
        prompt_tokens: prompt || null,
        completion_tokens: completion || null,
        cost_usd: prompt || completion ? aiCost(model, prompt, completion) : null,
        estimated: !!usage.estimated,
        tool_calls: Number.isFinite(Number(usage.tool_calls)) ? Number(usage.tool_calls) : null,
        duration_ms: Math.round(Date.now() - opts.startedAt),
        ok: opts.ok ?? true,
        error: opts.error ? opts.error.slice(0, 500) : null,
      });
    if (error) console.error("[ai-usage] falha ao registrar:", error.message);
  } catch (e) {
    console.error("[ai-usage] falha ao registrar:", e);
  }
}
