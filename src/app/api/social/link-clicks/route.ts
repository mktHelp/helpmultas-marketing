import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public click-tracking beacon for the "link in bio" WhatsApp redirect pages
// on the landing site. Called as a fire-and-forget `fetch(..., { mode:
// "no-cors" })` right before the page redirects to wa.me, the same way those
// pages already ping Google Sheets — so this has to be a plain GET with no
// custom headers (no-cors strips anything else) and no response the caller
// reads. Matched by `link_slug` instead of the raw account uuid so the
// landing site never needs to know internal ids.
//
// Instagram/Facebook's in-app browser reloads the destination page more
// than once per real tap (its own link-safety check, then the actual
// navigation), each hop with a different referrer but from the same
// underlying device/network — so it still shares one IP. Dedup on
// (account_id, ip) within a short window instead of inserting every hit.
const DEDUP_WINDOW_MS = 90_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug é obrigatório" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const admin = createAdminClient();

  const { data: account, error: findError } = await admin
    .from("social_accounts")
    .select("id")
    .eq("link_slug", slug)
    .maybeSingle();

  if (findError || !account) {
    return NextResponse.json({ error: "Nenhuma conta cadastrada com esse link_slug" }, { status: 404 });
  }

  if (ip) {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: recent } = await admin
      .from("social_link_clicks")
      .select("id")
      .eq("account_id", account.id)
      .eq("ip", ip)
      .gte("clicked_at", since)
      .limit(1)
      .maybeSingle();

    if (recent) {
      return NextResponse.json({ ok: true, deduped: true });
    }
  }

  const { error: insertError } = await admin.from("social_link_clicks").insert({
    account_id: account.id,
    url: searchParams.get("url") || null,
    referrer: searchParams.get("referrer") || null,
    user_agent: searchParams.get("user_agent") || null,
    ip,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
