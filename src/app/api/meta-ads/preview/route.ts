import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Preview visual de um anúncio (iframe sandbox oficial da Meta). Exige
// sessão de usuário (não o shared secret do sync) — é chamado direto do
// navegador quando alguém clica num anúncio na aba "Tráfego Pago".

const GRAPH_VERSION = "v21.0";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const metaAdId = new URL(request.url).searchParams.get("metaAdId");
  if (!metaAdId) {
    return NextResponse.json({ error: "metaAdId é obrigatório" }, { status: 400 });
  }

  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "META_SYSTEM_USER_TOKEN não configurado" }, { status: 500 });
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${metaAdId}/previews?${new URLSearchParams({
    ad_format: "MOBILE_FEED_STANDARD",
    access_token: token,
  })}`;
  const res = await fetch(url);
  const json = (await res.json()) as { data?: { body: string }[]; error?: { message: string } };
  if (json.error) {
    return NextResponse.json({ error: json.error.message }, { status: 502 });
  }

  const body = json.data?.[0]?.body ?? "";
  const match = body.match(/src="([^"]+)"/);
  const previewUrl = match ? match[1].replace(/&amp;/g, "&") : null;
  if (!previewUrl) {
    return NextResponse.json({ error: "Não foi possível gerar o preview desse anúncio" }, { status: 502 });
  }

  return NextResponse.json({ previewUrl });
}
