import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { logAiUsage } from "@/lib/aiUsage";

// Botão "Gerar variação" da aba Pautas do Dia: pede ao Helpinho (mesmo webhook do
// assistente, N8N_ASSISTENTE_WEBHOOK_URL) outra versão da pauta, com outro gancho
// e ângulo sobre a MESMA notícia, e salva como pauta nova (variation_of = original).
// A inserção usa o service role porque content_ideas só aceita insert do n8n.

export const dynamic = "force-dynamic";

const FORMATS = ["reels", "feed", "carrossel", "stories"] as const;

function pickJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const str = (v: unknown, max = 4000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(request: Request) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user || !profile) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (profile.role === "expansao") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const webhookUrl = process.env.N8N_ASSISTENTE_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ error: "IA não configurada (N8N_ASSISTENTE_WEBHOOK_URL ausente)" }, { status: 500 });

  const body = await request.json().catch(() => null);
  const ideaId = typeof body?.ideaId === "string" ? body.ideaId : "";
  if (!/^[0-9a-f-]{36}$/i.test(ideaId)) return NextResponse.json({ error: "Pauta inválida" }, { status: 400 });

  const admin = createAdminClient();
  const { data: idea, error } = await admin.from("content_ideas").select("*").eq("id", ideaId).single();
  if (error || !idea) return NextResponse.json({ error: "Pauta não encontrada" }, { status: 404 });

  const prompt = `Você é o pauteiro do marketing da Help Multas (recursos de multas de trânsito). Não use nenhuma ferramenta: responda só com o JSON pedido.

Abaixo está uma pauta de Instagram já pronta. Crie UMA VARIAÇÃO sobre a MESMA notícia, para a mesma conta e o mesmo formato, mas com outro ângulo e um gancho bem diferente (se a original é alerta, tente pergunta, mito x verdade, opinião ou "o que ninguém te contou").

PAUTA ORIGINAL:
${JSON.stringify({
    conta: idea.account === "roberson" ? "@roberson.alvarenga (primeira pessoa, opinião de dono de empresa de multas)" : "@helpmultasfranchising (notícia quente, foco em compartilhamento)",
    formato: idea.format,
    titulo: idea.title,
    gancho: idea.hook,
    roteiro: idea.script,
    legenda: idea.caption,
    noticia: { titulo: idea.source_title, veiculo: idea.source_name, link: idea.source_url },
  })}

REGRAS:
- Não invente lei, valor de multa, pontos, artigo ou data. Use só o que está na notícia e na pauta original. Se citar um número que não está no título da notícia, marque needs_check = true e diga em check_note o que conferir.
- Reels: hook até 12 palavras; script falado de 30 a 60s, frases curtas. Carrossel: "Slide 1: ...". Feed: texto da arte. Stories: 3 a 5 telas com interação.
- caption com emoji no início, 3 a 6 linhas e hashtags no final. cta para a Help Multas.
- why: 1 frase específica sobre por que este ângulo deve performar.
- Português do Brasil.

Responda APENAS com JSON:
{"title":"","hook":"","script":"","caption":"","cta":"","why":"","needs_check":false,"check_note":""}`;

  let reply: string;
  const startedAt = Date.now();
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatInput: prompt, sessionId: `pauta-variacao-${user.id}-${Date.now()}`, userName: profile.full_name ?? "" }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`n8n respondeu ${res.status}`);
    const data = await res.json();
    reply = data?.output ?? data?.text ?? data?.reply ?? "";
    await logAiUsage({ source: "pauta_variacao", userId: user.id, startedAt, data });
  } catch (e) {
    console.error("[pautas-variation]", e);
    await logAiUsage({ source: "pauta_variacao", userId: user.id, startedAt, ok: false, error: e instanceof Error ? e.message : "falha" });
    return NextResponse.json({ error: "Não consegui falar com a IA agora. Tente de novo em instantes." }, { status: 502 });
  }

  const v = pickJson(String(reply));
  const title = v && str(v.title, 200);
  if (!v || !title) return NextResponse.json({ error: "A IA não devolveu uma variação válida." }, { status: 502 });

  const { data: created, error: insertError } = await admin
    .from("content_ideas")
    .insert({
      batch_date: idea.batch_date,
      period: idea.period,
      account: idea.account,
      format: FORMATS.includes(idea.format) ? idea.format : "reels",
      theme: idea.theme,
      title,
      hook: str(v.hook, 300),
      script: str(v.script),
      caption: str(v.caption),
      cta: str(v.cta, 500),
      why: str(v.why, 500),
      reference_permalink: idea.reference_permalink,
      reference_note: idea.reference_note,
      source_title: idea.source_title,
      source_url: idea.source_url,
      source_name: idea.source_name,
      source_published_at: idea.source_published_at,
      source_tier: idea.source_tier,
      score: idea.score,
      score_breakdown: idea.score_breakdown,
      needs_check: v.needs_check === true || idea.needs_check,
      check_note: str(v.check_note, 500) ?? idea.check_note,
      variation_of: idea.variation_of ?? idea.id,
    })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ idea: created });
}
