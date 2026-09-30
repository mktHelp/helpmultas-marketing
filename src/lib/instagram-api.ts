import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Acesso à API do Instagram (Instagram Login) compartilhado entre o sync
// completo (api/instagram/sync) e o snapshot leve de seguidores que alimenta
// o card "Seguidores" do dashboard. Um token de longa duração por perfil em
// instagram_tokens (só service-role), renovado aqui quando perto de expirar.

export type Admin = ReturnType<typeof createAdminClient>;

export const GRAPH_BASE = "https://graph.instagram.com/v21.0";
const REFRESH_URL = "https://graph.instagram.com/refresh_access_token";
const REFRESH_WHEN_DAYS_LEFT = 15;

// Fonte gravada em social_follower_snapshots (o card mostra "automático" pra
// qualquer valor diferente de "manual").
export const FOLLOWER_SOURCE = "instagram_graph_api";

export class GraphApiError extends Error {}

export interface TokenRow {
  access_token: string;
  expires_at: string;
}

export async function graph<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH_BASE}/${path}?${qs}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new GraphApiError(json.error?.message || `Graph API ${res.status}`);
  }
  return json as T;
}

// Renova o token se estiver perto de expirar; devolve o token em uso.
export async function ensureFreshToken(admin: Admin, accountId: string, row: TokenRow): Promise<string> {
  const daysLeft = (Date.parse(row.expires_at) - Date.now()) / 86400000;
  if (daysLeft > REFRESH_WHEN_DAYS_LEFT) return row.access_token;
  if (daysLeft <= 0) throw new GraphApiError("Token expirado — gere um novo e rode npm run ig-token");

  const qs = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: row.access_token });
  const res = await fetch(`${REFRESH_URL}?${qs}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json.access_token) return row.access_token; // tenta com o atual
  await admin
    .from("instagram_tokens")
    .update({
      access_token: json.access_token,
      expires_at: new Date(Date.now() + (json.expires_in ?? 5184000) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId);
  return json.access_token;
}

export async function getAccountToken(admin: Admin, accountId: string): Promise<string | null> {
  const { data } = await admin
    .from("instagram_tokens")
    .select("access_token, expires_at")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data) return null;
  return ensureFreshToken(admin, accountId, data as TokenRow);
}

export async function recordFollowerSnapshot(
  admin: Admin,
  accountId: string,
  followers: number,
  mediaCount: number | null
) {
  const { error } = await admin.from("social_follower_snapshots").insert({
    account_id: accountId,
    followers_count: followers,
    media_count: mediaCount,
    source: FOLLOWER_SOURCE,
    captured_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Snapshot leve (só seguidores e nº de posts) dos perfis cujo último registro
// tem mais de `minMinutes`. Chamado depois da resposta do dashboard (after())
// e pelo cron — substitui o workflow do n8n que gravava isso a cada hora.
export async function refreshFollowerSnapshotsIfStale(minMinutes = 15) {
  const admin = createAdminClient();
  const { data: accounts } = await admin.from("social_accounts").select("id").eq("platform", "instagram");
  const cutoff = Date.now() - minMinutes * 60 * 1000;

  for (const { id } of accounts ?? []) {
    try {
      const { data: last } = await admin
        .from("social_follower_snapshots")
        .select("captured_at")
        .eq("account_id", id)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last && Date.parse(last.captured_at) > cutoff) continue;

      const token = await getAccountToken(admin, id);
      if (!token) continue;
      const me = await graph<Record<string, unknown> & { followers_count?: number; media_count?: number }>(token, "me", {
        fields: "username,name,followers_count,follows_count,media_count,profile_picture_url",
      });
      if (typeof me.followers_count === "number") {
        await recordFollowerSnapshot(admin, id, me.followers_count, me.media_count ?? null);
      }
      // A URL da foto do Instagram expira em poucos dias: renova junto, sem
      // perder bio/site que o sync completo já guardou no mesmo registro.
      const { data: existing } = await admin
        .from("instagram_audience")
        .select("data")
        .eq("account_id", id)
        .eq("kind", "profile")
        .maybeSingle();
      await admin.from("instagram_audience").upsert(
        { account_id: id, kind: "profile", data: { ...(existing?.data as object | undefined), ...me }, synced_at: new Date().toISOString() },
        { onConflict: "account_id,kind" }
      );
    } catch {
      // Falha num perfil não impede os outros nem a página que disparou.
    }
  }
}
