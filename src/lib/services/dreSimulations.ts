import type { SupabaseClient } from "@supabase/supabase-js";
import type { DreInput, DreResult } from "@/lib/expansion/dre";

/** Grava (ou atualiza) a simulação do lead. Uma por nome de lead, sem diferenciar maiúsculas. */
export async function saveDreSimulation(supabase: SupabaseClient, input: DreInput, c: DreResult, userId: string | null) {
  const leadName = input.lead.trim();
  if (!leadName) throw new Error("Informe o nome do lead antes de salvar.");

  const summary = {
    mercado: Math.round(c.mercado),
    casosMes: Number(c.casosMes.toFixed(2)),
    parceiros: input.parceiros,
    casosParceiros: Number(c.casosParceiros.toFixed(2)),
    ticket: c.ticket,
    investimento: c.inv,
    despesaFixaMes: c.fixa,
    retornoMes: c.pay,
    resultadoMes: Math.round(c.pico.resultado),
    lucro36m: Math.round(c.meses[35].acc),
    roi36: c.roi36 !== null ? Number(c.roi36.toFixed(2)) : null,
    equilibrioCasos: c.equilibrio !== null ? Number(c.equilibrio.toFixed(2)) : null,
  };

  const { data: existing, error: findError } = await supabase
    .from("dre_simulations")
    .select("id")
    .ilike("lead_name", leadName.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (findError) throw findError;

  const payload = { lead_name: leadName, region: input.regiao, inputs: input, summary, updated_by: userId, updated_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabase.from("dre_simulations").update(payload).eq("id", existing.id);
    if (error) throw error;
    return "updated" as const;
  }
  const { error } = await supabase.from("dre_simulations").insert({ ...payload, created_by: userId });
  if (error) throw error;
  return "created" as const;
}
