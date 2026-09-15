import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";

// Proxies chat messages to the n8n "Helpinho" workflow (Chat Trigger + Gemini
// agent). Kept server-side so the n8n webhook URL never reaches the browser
// and every request carries a verified Supabase session. Messages are
// persisted per-conversation in `assistant_messages` so history survives
// refreshes and old threads can be reopened with their own context.

const HISTORY_LIMIT = 100;
const TITLE_LENGTH = 60;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId é obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("[assistente] falha ao carregar histórico:", error.message);
    return NextResponse.json({ error: "Não foi possível carregar o histórico." }, { status: 500 });
  }

  return NextResponse.json({ messages: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, profile } = await getCurrentUserAndProfile();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const webhookUrl = process.env.N8N_ASSISTENTE_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Assistente não configurado (N8N_ASSISTENTE_WEBHOOK_URL ausente)" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  if (!message) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId é obrigatório" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("assistant_conversations")
    .select("id, title, preview")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatInput: message,
        sessionId: conversationId,
        userName: profile?.full_name ?? "",
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    return NextResponse.json({ error: "Não consegui falar com o assistente agora. Tente de novo em instantes." }, { status: 502 });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[assistente] n8n respondeu ${response.status}:`, body.slice(0, 2000));
    return NextResponse.json({ error: "O assistente retornou um erro." }, { status: 502 });
  }

  const data = await response.json().catch(() => null);
  const reply = data?.output ?? data?.text ?? data?.reply;
  if (typeof reply !== "string") {
    return NextResponse.json({ error: "Resposta inesperada do assistente." }, { status: 502 });
  }

  const { error: saveError } = await supabase.from("assistant_messages").insert([
    { user_id: user.id, conversation_id: conversationId, role: "user", content: message },
    { user_id: user.id, conversation_id: conversationId, role: "assistant", content: reply },
  ]);
  if (saveError) {
    console.error("[assistente] falha ao salvar histórico:", saveError.message);
  }

  const preview = reply.length > TITLE_LENGTH ? `${reply.slice(0, TITLE_LENGTH)}…` : reply;
  const update: { preview: string; title?: string } = { preview };
  if (conversation.title === "Nova conversa") {
    update.title = message.length > TITLE_LENGTH ? `${message.slice(0, TITLE_LENGTH)}…` : message;
  }
  const { error: updateError } = await supabase.from("assistant_conversations").update(update).eq("id", conversationId);
  if (updateError) {
    console.error("[assistente] falha ao atualizar conversa:", updateError.message);
  }

  return NextResponse.json({ reply });
}
