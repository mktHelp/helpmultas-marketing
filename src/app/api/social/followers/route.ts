import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Ingest endpoint for the n8n workflow that polls the Instagram Graph API
// every 15 minutes. Not a user-session route — authenticated with a shared
// secret (SOCIAL_INGEST_TOKEN) instead, and writes with the service-role
// client since there's no Supabase user to carry RLS. Matches accounts by
// `ig_username` so the caller only needs to send what the Graph API already
// returns, no internal ids.
//
// Body: one item, or an array of items, shaped like the Graph API response:
// { username: string, followers_count: number, media_count?: number }

interface IngestItem {
  username?: string;
  followers_count?: number;
  media_count?: number;
}

export async function POST(request: Request) {
  const token = process.env.SOCIAL_INGEST_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "SOCIAL_INGEST_TOKEN não configurado" }, { status: 500 });
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const items: IngestItem[] = Array.isArray(body) ? body : body ? [body] : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Corpo vazio" }, { status: 400 });
  }

  const admin = createAdminClient();
  const results: { username: string; ok: boolean; error?: string }[] = [];

  for (const item of items) {
    const username = item.username?.trim();
    if (!username || typeof item.followers_count !== "number") {
      results.push({ username: username || "?", ok: false, error: "username e followers_count são obrigatórios" });
      continue;
    }

    const { data: account, error: findError } = await admin
      .from("social_accounts")
      .select("id")
      .eq("ig_username", username)
      .maybeSingle();

    if (findError || !account) {
      results.push({ username, ok: false, error: "Nenhuma conta cadastrada com esse ig_username" });
      continue;
    }

    const { error: insertError } = await admin.from("social_follower_snapshots").insert({
      account_id: account.id,
      followers_count: item.followers_count,
      media_count: item.media_count ?? null,
      source: "instagram_graph_api",
      captured_at: new Date().toISOString(),
    });

    results.push({ username, ok: !insertError, error: insertError?.message });
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ results }, { status: allOk ? 200 : 207 });
}
