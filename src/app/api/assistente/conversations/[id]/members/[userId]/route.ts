import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id: conversationId, userId: targetUserId } = await params;

  // RLS only allows this when the caller is the conversation's owner or is
  // removing themselves ("leave"), so no extra ownership check is needed here.
  const { error } = await supabase
    .from("assistant_conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", targetUserId);

  if (error) {
    console.error("[assistente] falha ao remover acesso:", error.message);
    return NextResponse.json({ error: "Não foi possível remover o acesso." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
