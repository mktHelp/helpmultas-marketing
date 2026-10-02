import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";

// Helpinho no Teleprompter: gera e revisa roteiros no estilo do Rober.
//
// Reaproveita o webhook do n8n do Helpinho (N8N_ASSISTENTE_WEBHOOK_URL), então
// não precisa de chave de IA nova no app. Cada chamada usa uma sessão própria
// (sem memória de conversa) e leva junto a BASE DE ESTILO: o histórico de
// roteiros já criados (priorizando os já gravados) e as notas de roteiro das
// tarefas de conteúdo. Fica no servidor para o webhook nunca chegar ao browser.

const MAX_BRIEF = 4000;
const MAX_SCRIPT = 20000;
const STYLE_BUDGET_CHARS = 16000;
const PER_ITEM_CHARS = 1800;

type StyleItem = { title: string; text: string; recorded: boolean };

async function loadStyleBase(excludeId?: string): Promise<StyleItem[]> {
  const supabase = await createClient();
  const items: StyleItem[] = [];

  const { data: scripts, error: scriptsError } = await supabase
    .from("teleprompter_scripts")
    .select("id, title, content, is_recorded, updated_at")
    .order("is_recorded", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(30);
  if (scriptsError) console.error("[teleprompter-ai] falha ao ler roteiros:", scriptsError.message);
  for (const s of scripts ?? []) {
    if (s.id === excludeId) continue;
    const text = (s.content ?? "").trim();
    if (text.length >= 60) items.push({ title: s.title, text, recorded: !!s.is_recorded });
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("title, script_notes, caption")
    .is("deleted_at", null)
    .not("script_notes", "is", null)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (tasksError) console.error("[teleprompter-ai] falha ao ler tarefas:", tasksError.message);
  for (const t of tasks ?? []) {
    const text = [t.script_notes, t.caption].filter(Boolean).join("\n\nLegenda: ").trim();
    if (text.length >= 60) items.push({ title: `Tarefa: ${t.title}`, text, recorded: false });
  }

  // Monta dentro do orçamento de caracteres, do mais relevante ao menos.
  const picked: StyleItem[] = [];
  let used = 0;
  for (const item of items) {
    const text = item.text.length > PER_ITEM_CHARS ? `${item.text.slice(0, PER_ITEM_CHARS)}…` : item.text;
    if (used + text.length > STYLE_BUDGET_CHARS) break;
    picked.push({ ...item, text });
    used += text.length;
  }
  return picked;
}

function styleSection(items: StyleItem[]) {
  if (items.length === 0) {
    return "BASE DE ESTILO: ainda não há roteiros anteriores salvos. Use um tom direto, próximo e confiante, de quem explica multas de trânsito de forma simples.";
  }
  const body = items
    .map((it, i) => `--- Exemplo ${i + 1}${it.recorded ? " (já gravado)" : ""}: ${it.title}\n${it.text}`)
    .join("\n\n");
  return `BASE DE ESTILO — roteiros e conteúdos anteriores do Rober (estude o tom, o vocabulário, o ritmo das frases, como abre com gancho, como explica e como fecha com chamada para ação; os já gravados são a melhor referência):\n\n${body}`;
}

const WRITING_RULES = `REGRAS DE ESCRITA:
- Texto para ser LIDO EM VOZ ALTA no teleprompter: frases curtas, linguagem falada, sem jargão desnecessário.
- Parágrafos curtos separados por uma linha em branco (cada um marca uma pausa/respiração).
- Comece com um gancho forte nos primeiros segundos e termine com uma chamada para ação coerente com os exemplos.
- Sem títulos, sem marcações de cena, sem emojis, sem hashtags, sem aspas em volta do texto.
- Não copie trechos dos exemplos: escreva algo novo no mesmo estilo.
- Não invente leis, artigos, prazos, valores ou números. Se um dado legal for essencial e você não tiver certeza, escreva de forma genérica ou sinalize entre colchetes [CONFERIR: ...].`;

export async function POST(request: Request) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const webhookUrl = process.env.N8N_ASSISTENTE_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "IA não configurada (N8N_ASSISTENTE_WEBHOOK_URL ausente)" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "generate" && action !== "review") {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, MAX_BRIEF) : "";
  const script = typeof body?.script === "string" ? body.script.trim().slice(0, MAX_SCRIPT) : "";
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim().slice(0, 1000) : "";
  const excludeId = typeof body?.scriptId === "string" ? body.scriptId : undefined;
  const duration = Math.min(Math.max(Number(body?.durationSeconds) || 60, 15), 300);

  if (action === "generate" && !brief) {
    return NextResponse.json({ error: "Conte do que é o vídeo para eu escrever o roteiro." }, { status: 400 });
  }
  if (action === "review" && !script) {
    return NextResponse.json({ error: "Não há texto para revisar." }, { status: 400 });
  }

  const style = styleSection(await loadStyleBase(excludeId));
  const words = Math.round((duration / 60) * 150);

  const prompt =
    action === "generate"
      ? `Você é o Helpinho, assistente de marketing da Help Multas, agora no papel de roteirista de vídeos curtos do Roberson Alvarenga ("Rober"). Escreva roteiros que soem exatamente como ele fala. Não use nenhuma ferramenta: a base de estilo já está abaixo e você deve apenas devolver o texto.

${style}

${WRITING_RULES}

TAREFA: escreva um roteiro de cerca de ${duration} segundos (aproximadamente ${words} palavras) sobre:
${brief}
${instruction ? `\nORIENTAÇÕES EXTRAS: ${instruction}\n` : ""}
Responda SOMENTE com o texto do roteiro, sem comentários antes ou depois.`
      : `Você é o Helpinho, assistente de marketing da Help Multas, agora no papel de revisor de roteiros do Roberson Alvarenga ("Rober"). Seu trabalho é deixar o texto com a cara dele, sem mudar o que ele quer dizer. Não use nenhuma ferramenta: a base de estilo já está abaixo e você deve apenas devolver o texto.

${style}

${WRITING_RULES}

ROTEIRO PARA REVISAR:
${script}
${instruction ? `\nORIENTAÇÕES EXTRAS: ${instruction}\n` : ""}
TAREFA: revise o roteiro no estilo do Rober — melhore clareza, ritmo e naturalidade na fala, corte gordura, reforce o gancho e o fechamento — mantendo o sentido e os fatos.

Responda EXATAMENTE neste formato:
### ROTEIRO REVISADO
<o roteiro revisado, só o texto>
### O QUE MUDEI
- <até 5 itens curtos explicando as principais mudanças>`;

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatInput: prompt,
        sessionId: `teleprompter-${user.id}-${Date.now()}`,
        userName: profile?.full_name ?? "",
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    return NextResponse.json({ error: "Não consegui falar com a IA agora. Tente de novo em instantes." }, { status: 502 });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[teleprompter-ai] n8n respondeu ${response.status}:`, text.slice(0, 2000));
    return NextResponse.json({ error: "A IA retornou um erro." }, { status: 502 });
  }

  const data = await response.json().catch(() => null);
  const reply = data?.output ?? data?.text ?? data?.reply;
  if (typeof reply !== "string" || !reply.trim()) {
    return NextResponse.json({ error: "Resposta inesperada da IA." }, { status: 502 });
  }

  if (action === "review") {
    const [rawScript, rawNotes = ""] = reply.split(/###\s*O QUE MUDEI/i);
    const revised = rawScript.replace(/^\s*###\s*ROTEIRO REVISADO\s*/i, "").trim();
    return NextResponse.json({ text: revised || reply.trim(), notes: rawNotes.trim() });
  }

  return NextResponse.json({ text: reply.trim() });
}
