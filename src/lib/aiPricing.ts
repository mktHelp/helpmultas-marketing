// Preço dos modelos da OpenAI em US$ por 1 milhão de tokens, para o cálculo de custo
// das chamadas registradas em ai_usage_events. Confira em openai.com/api/pricing ao
// trocar de modelo: o valor vale para as chamadas novas (o custo fica gravado).
// Para o Radar de Pauta, os preços ficam nos Ajustes da IA (content_radar_settings).

export const AI_PRICES: Record<string, { in: number; out: number }> = {
  "gpt-5-nano": { in: 0.05, out: 0.4 },
  "gpt-5-mini": { in: 0.25, out: 2 },
  "gpt-5": { in: 1.25, out: 10 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
};

/** Custo em US$; null quando o modelo não está na tabela. */
export function aiCost(model: string | null | undefined, promptTokens: number, completionTokens: number) {
  if (!model) return null;
  // aceita variações com data (ex.: gpt-5-mini-2025-08-07)
  const key = Object.keys(AI_PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model === k || model.startsWith(`${k}-`));
  if (!key) return null;
  const p = AI_PRICES[key];
  return (promptTokens * p.in + completionTokens * p.out) / 1e6;
}
