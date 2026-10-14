import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";

// Botão "Gerar pautas agora" da aba Pautas do Dia.
// 1. Cria a linha em content_idea_runs (status running). O índice único parcial
//    garante uma execução por vez: se já há uma rodando, devolve 409 com ela.
// 2. Dispara o webhook do workflow n8n "Radar de Pauta" passando o run_id; o n8n
//    responde na hora e vai atualizando step/step_label, que o Hub lê via Realtime.
// Execuções "running" há mais de STALE_MIN minutos são dadas como travadas.

export const dynamic = "force-dynamic";

const STALE_MIN = 10;

export async function POST() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user || !profile) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (profile.role === "expansao") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const webhookUrl = process.env.N8N_RADAR_PAUTA_WEBHOOK_URL;
  const secret = process.env.N8N_RADAR_PAUTA_SECRET;
  if (!webhookUrl || !secret) {
    return NextResponse.json({ error: "Radar de Pauta não configurado (N8N_RADAR_PAUTA_WEBHOOK_URL / N8N_RADAR_PAUTA_SECRET)." }, { status: 500 });
  }

  const admin = createAdminClient();

  await admin
    .from("content_idea_runs")
    .update({ status: "error", error_message: "Tempo esgotado (execução travada).", finished_at: new Date().toISOString() })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - STALE_MIN * 60e3).toISOString());

  const { data: run, error } = await admin
    .from("content_idea_runs")
    .insert({ source: "manual", triggered_by: profile.id, step_label: "Acordando o Helpinho" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: running } = await admin.from("content_idea_runs").select("*").eq("status", "running").maybeSingle();
      return NextResponse.json({ error: "Já existe uma geração em andamento.", run: running }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-radar-secret": secret },
      body: JSON.stringify({ run_id: run.id }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`n8n respondeu ${res.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("content_idea_runs")
      .update({ status: "error", error_message: `Não foi possível acionar o n8n: ${msg}`, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return NextResponse.json({ error: "Não foi possível acionar o workflow no n8n." }, { status: 502 });
  }

  return NextResponse.json({ run });
}
