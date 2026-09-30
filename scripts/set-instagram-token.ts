/**
 * Cadastra/atualiza o token do Instagram Login de um perfil (guardado em
 * instagram_tokens, só acessível pela service-role). O token gerado no painel
 * do app (Instagram > Gerar token) é de longa duração (~60 dias); o sync
 * renova sozinho depois.
 *
 *   npm run ig-token -- <ig_username> <token>
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const [username, token] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!username || !token) {
  console.error("Uso: npm run ig-token -- <ig_username> <token>");
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // Confere o token e descobre a qual perfil ele pertence.
  const me = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=username&access_token=${encodeURIComponent(token)}`
  ).then((r) => r.json());
  if (me.error) throw new Error(`Token recusado pela Meta: ${me.error.message}`);
  if (me.username?.toLowerCase() !== username.toLowerCase()) {
    throw new Error(`O token é do perfil @${me.username}, não de @${username}`);
  }

  const { data: account, error } = await supabase
    .from("social_accounts")
    .select("id, label")
    .ilike("ig_username", username)
    .maybeSingle();
  if (error) throw error;
  if (!account) throw new Error(`Nenhum social_accounts com ig_username = ${username}`);

  const { error: upsertError } = await supabase.from("instagram_tokens").upsert({
    account_id: account.id,
    access_token: token,
    expires_at: new Date(Date.now() + 60 * 86400 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (upsertError) throw upsertError;
  console.log(`Token salvo para ${account.label} (@${me.username})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
