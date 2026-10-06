import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_INPUT, migrateInput, type DreInput, type DreResult } from "@/lib/expansion/dre";

export interface DreSimulationRow {
  id: string;
  lead_name: string;
  region: string;
  summary: {
    mercado?: number;
    casosMes?: number;
    parceiros?: number;
    investimento?: number;
    retornoMes?: number | null;
    resultadoMes?: number;
    lucro36m?: number;
    roi36?: number | null;
  };
  updated_at: string;
}

/** Erro lançado quando outra pessoa salvou a mesma simulação depois que ela foi aberta aqui. */
export class DreConflictError extends Error {
  constructor() {
    super("Outra pessoa salvou esta simulação depois que você a abriu.");
    this.name = "DreConflictError";
  }
}

/** Lista leve (sem o preenchimento completo) das simulações salvas, mais recentes primeiro. */
export async function listDreSimulations(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("dre_simulations")
    .select("id, lead_name, region, summary, updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as DreSimulationRow[];
}

/** Preenchimento completo de uma simulação. Campos que não existiam quando foi salva ganham o valor padrão. */
export async function getDreSimulation(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("dre_simulations").select("id, inputs, updated_at").eq("id", id).single();
  if (error) throw error;
  return {
    id: data.id as string,
    updatedAt: data.updated_at as string,
    input: migrateInput({ ...structuredClone(DEFAULT_INPUT), ...(data.inputs as Partial<DreInput>) } as DreInput),
  };
}

/**
 * Grava (ou atualiza) a simulação do lead. Uma por nome de lead, sem diferenciar maiúsculas.
 * `expectedUpdatedAt`: versão que esta pessoa abriu; se o registro mudou desde então (e `force`
 * não foi pedido), lança DreConflictError em vez de sobrescrever o trabalho de outra pessoa.
 */
export async function saveDreSimulation(
  supabase: SupabaseClient,
  input: DreInput,
  c: DreResult,
  userId: string | null,
  opts: { expectedId?: string | null; expectedUpdatedAt?: string | null; force?: boolean } = {}
) {
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
    .select("id, updated_at")
    .ilike("lead_name", leadName.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (findError) throw findError;

  const now = new Date().toISOString();
  const payload = { lead_name: leadName, region: input.regiao, inputs: input, summary, updated_by: userId, updated_at: now };
  if (existing) {
    if (!opts.force && opts.expectedId === existing.id && opts.expectedUpdatedAt && Date.parse(existing.updated_at) !== Date.parse(opts.expectedUpdatedAt)) throw new DreConflictError();
    const { error } = await supabase.from("dre_simulations").update(payload).eq("id", existing.id);
    if (error) throw error;
    return { kind: "updated" as const, id: existing.id as string, updatedAt: now };
  }
  const { data, error } = await supabase.from("dre_simulations").insert({ ...payload, created_by: userId }).select("id").single();
  if (error) throw error;
  return { kind: "created" as const, id: data.id as string, updatedAt: now };
}
