import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id, title, preview, updated_at, user_id, owner:profiles!user_id(full_name, avatar_url)")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[assistente] falha ao listar conversas:", error.message);
    return NextResponse.json({ error: "Não foi possível carregar as conversas." }, { status: 500 });
  }

  const ownedIds = (data || []).filter((c) => c.user_id === user.id).map((c) => c.id);
  let membersByConversation = new Map<string, { id: string; full_name: string; avatar_url: string | null }[]>();
  if (ownedIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("assistant_conversation_members")
      .select("conversation_id, profiles:profiles!user_id(id, full_name, avatar_url)")
      .in("conversation_id", ownedIds);
    membersByConversation = new Map();
    for (const row of memberRows || []) {
      const list = membersByConversation.get(row.conversation_id) || [];
      if (row.profiles) list.push(row.profiles as unknown as { id: string; full_name: string; avatar_url: string | null });
      membersByConversation.set(row.conversation_id, list);
    }
  }

  const conversations = (data || []).map((c) => ({
    ...c,
    isOwner: c.user_id === user.id,
    members: membersByConversation.get(c.id) || [],
  }));
  return NextResponse.json({ conversations });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({ user_id: user.id })
    .select("id, title, preview, updated_at, user_id")
    .single();

  if (error) {
    console.error("[assistente] falha ao criar conversa:", error.message);
    return NextResponse.json({ error: "Não foi possível criar a conversa." }, { status: 500 });
  }

  return NextResponse.json({ conversation: { ...data, isOwner: true, members: [] } });
}
