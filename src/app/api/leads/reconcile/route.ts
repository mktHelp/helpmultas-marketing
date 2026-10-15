import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { runReconciliation } from "@/lib/lead-reconciliation";

// Validação de leads LP/nativo × CRM (ver lib/lead-reconciliation.ts).
//   GET  — GitHub Actions a cada 3h (.github/workflows/lead-reconciliation.yml),
//          autenticado com CRON_SECRET.
//   POST — botão "Validar agora" em /trafego-pago/leads/validacao (sessão).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run() {
  try {
    const result = await runReconciliation(createAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 500 });
  if ((request.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return run();
}

export async function POST() {
  const { user } = await getCurrentUserAndProfile();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return run();
}
