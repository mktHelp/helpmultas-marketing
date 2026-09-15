import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase.from("assistant_conversations").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    console.error("[assistente] falha ao excluir conversa:", error.message);
    return NextResponse.json({ error: "Não foi possível excluir a conversa." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
