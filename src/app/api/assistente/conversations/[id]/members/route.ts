import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const { data, error } = await supabase
    .from("assistant_conversation_members")
    .select("user_id, profiles:profiles!user_id(id, full_name, avatar_url)")
    .eq("conversation_id", conversationId);

  if (error) {
    console.error("[assistente] falha ao listar membros:", error.message);
    return NextResponse.json({ error: "Não foi possível listar quem tem acesso." }, { status: 500 });
  }

  const members = (data || []).map((row) => row.profiles).filter(Boolean);
  return NextResponse.json({ members });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";
  if (!targetUserId) {
    return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("assistant_conversations")
    .select("id, title, user_id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Só quem criou a conversa pode compartilhá-la." }, { status: 404 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Você já tem acesso a esta conversa." }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from("assistant_conversation_members")
    .insert({ conversation_id: conversationId, user_id: targetUserId, added_by: user.id });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Essa pessoa já tem acesso a esta conversa." }, { status: 409 });
    }
    console.error("[assistente] falha ao compartilhar conversa:", insertError.message);
    return NextResponse.json({ error: "Não foi possível compartilhar a conversa." }, { status: 500 });
  }

  const { data: owner } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  const { error: notificationError } = await supabase.from("notifications").insert({
    user_id: targetUserId,
    type: "conversation_shared",
    title: "Conversa compartilhada",
    message: `${owner?.full_name || "Alguém"} compartilhou uma conversa com você: "${conversation.title}"`,
    conversation_id: conversationId,
  });
  if (notificationError) {
    console.error("[assistente] falha ao notificar compartilhamento:", notificationError.message);
  }

  return NextResponse.json({ ok: true });
}
