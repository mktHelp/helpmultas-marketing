import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public click-tracking beacon for the "link in bio" WhatsApp redirect pages
// on the landing site. Called as a fire-and-forget `fetch(..., { mode:
// "no-cors" })` right before the page redirects to wa.me, the same way those
// pages already ping Google Sheets — so this has to be a plain GET with no
// custom headers (no-cors strips anything else) and no response the caller
// reads. Matched by `link_slug` instead of the raw account uuid so the
// landing site never needs to know internal ids.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug é obrigatório" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: account, error: findError } = await admin
    .from("social_accounts")
    .select("id")
    .eq("link_slug", slug)
    .maybeSingle();

  if (findError || !account) {
    return NextResponse.json({ error: "Nenhuma conta cadastrada com esse link_slug" }, { status: 404 });
  }

  const { error: insertError } = await admin.from("social_link_clicks").insert({
    account_id: account.id,
    url: searchParams.get("url") || null,
    referrer: searchParams.get("referrer") || null,
    user_agent: searchParams.get("user_agent") || null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
