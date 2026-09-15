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
    .select("id, title, preview, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[assistente] falha ao listar conversas:", error.message);
    return NextResponse.json({ error: "Não foi possível carregar as conversas." }, { status: 500 });
  }

  return NextResponse.json({ conversations: data });
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
    .select("id, title, preview, updated_at")
    .single();

  if (error) {
    console.error("[assistente] falha ao criar conversa:", error.message);
    return NextResponse.json({ error: "Não foi possível criar a conversa." }, { status: 500 });
  }

  return NextResponse.json({ conversation: data });
}
