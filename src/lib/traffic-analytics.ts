import { shiftDate, type DateRange } from "@/lib/period";
import type { TrafficStructure } from "@/lib/services/meta-ads";

// Cálculos da dashboard de Tráfego Pago sobre as métricas diárias por anúncio
// (meta_ad_insights). Funções puras — a tela só agrega e desenha.

export type InsightRow = TrafficStructure["insights"][number];

export interface TM {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  lpViews: number;
  leads: number;
}

export const zeroTM = (): TM => ({ spend: 0, impressions: 0, clicks: 0, reach: 0, lpViews: 0, leads: 0 });

export function addTM(a: TM, r: Pick<InsightRow, "spend" | "impressions" | "clicks" | "reach" | "lpViews" | "conversions">): TM {
  return {
    spend: a.spend + r.spend,
    impressions: a.impressions + r.impressions,
    clicks: a.clicks + r.clicks,
    reach: a.reach + r.reach,
    lpViews: a.lpViews + r.lpViews,
    leads: a.leads + r.conversions,
  };
}

export const sumTM = (rows: InsightRow[]): TM => rows.reduce<TM>((acc, r) => addTM(acc, r), zeroTM());

// Métricas derivadas (0 quando não há denominador).
export const ctr = (m: TM) => (m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0);
export const cpc = (m: TM) => (m.clicks > 0 ? m.spend / m.clicks : 0);
export const cpm = (m: TM) => (m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0);
export const cpl = (m: TM) => (m.leads > 0 ? m.spend / m.leads : 0);
export const frequency = (m: TM) => (m.reach > 0 ? m.impressions / m.reach : 0);
// Clique no anúncio que virou visita na LP (perda = lentidão/queda de página).
export const connectRate = (m: TM) => (m.clicks > 0 ? (m.lpViews / m.clicks) * 100 : 0);
export const leadRate = (m: TM) => (m.lpViews > 0 ? (m.leads / m.lpViews) * 100 : 0);

export type MetricKey = "spend" | "leads" | "cpl" | "impressions" | "reach" | "clicks" | "ctr" | "cpc" | "cpm";

export const METRIC_VALUE: Record<MetricKey, (m: TM) => number> = {
  spend: (m) => m.spend,
  leads: (m) => m.leads,
  cpl,
  impressions: (m) => m.impressions,
  reach: (m) => m.reach,
  clicks: (m) => m.clicks,
  ctr,
  cpc,
  cpm,
};

export function rowsInRange(rows: InsightRow[], range: DateRange, adIds: Set<string> | null): InsightRow[] {
  return rows.filter((r) => r.date >= range.from && r.date <= range.to && (!adIds || adIds.has(r.ad_id)));
}

// Uma linha por dia do período (dias sem dado entram zerados, pro gráfico não
// "pular" datas).
export function dailyTM(rows: InsightRow[], range: DateRange): (TM & { date: string })[] {
  const byDate = new Map<string, TM>();
  for (const r of rows) byDate.set(r.date, addTM(byDate.get(r.date) ?? zeroTM(), r));
  const out: (TM & { date: string })[] = [];
  for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) {
    out.push({ date: d, ...(byDate.get(d) ?? zeroTM()) });
  }
  return out;
}

export function groupTM(rows: InsightRow[], keyOf: (adId: string) => string | null): Map<string, TM> {
  const map = new Map<string, TM>();
  for (const r of rows) {
    const key = keyOf(r.ad_id);
    if (!key) continue;
    map.set(key, addTM(map.get(key) ?? zeroTM(), r));
  }
  return map;
}

export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// Média por dia da semana (só conta dias com algum gasto).
export function weekdayStats(daily: (TM & { date: string })[]) {
  return WEEKDAY_SHORT.map((label, wd) => {
    const days = daily.filter((d) => weekdayOf(d.date) === wd && d.spend > 0);
    const total = days.reduce((acc, d) => addTM(acc, { ...d, conversions: d.leads }), zeroTM());
    const n = Math.max(days.length, 1);
    return {
      label,
      long: WEEKDAY_LONG[wd],
      samples: days.length,
      spend: total.spend / n,
      leads: total.leads / n,
      cpl: cpl(total),
    };
  });
}

// ── Destaques automáticos ──────────────────────────────────────────────────

export interface EntityTM {
  id: string;
  name: string;
  m: TM;
}

export type TrafficHighlightKey = "bestCpl" | "wasted" | "frequency" | "cplTrend" | "weekday" | "funnel" | "bestCampaign";

export interface TrafficHighlight {
  key: TrafficHighlightKey;
  title: string;
  text: string;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nf = new Intl.NumberFormat("pt-BR");

const MIN_SPEND_FOR_VERDICT = 50;

export function buildTrafficHighlights(input: {
  totals: TM;
  previous: TM | null;
  ads: EntityTM[];
  campaigns: EntityTM[];
  weekday: ReturnType<typeof weekdayStats>;
}): TrafficHighlight[] {
  const { totals, previous, ads, campaigns, weekday } = input;
  const out: TrafficHighlight[] = [];

  const withLeads = ads.filter((a) => a.m.leads > 0 && a.m.spend >= 20).sort((a, b) => cpl(a.m) - cpl(b.m));
  if (withLeads[0]) {
    out.push({
      key: "bestCpl",
      title: "Melhor custo por lead",
      text: `${withLeads[0].name} — ${brl.format(cpl(withLeads[0].m))} por lead (${nf.format(withLeads[0].m.leads)} leads, ${brl.format(withLeads[0].m.spend)} investidos).`,
    });
  }

  const wasted = ads.filter((a) => a.m.spend >= MIN_SPEND_FOR_VERDICT && a.m.leads === 0);
  if (wasted.length > 0) {
    const total = wasted.reduce((s, a) => s + a.m.spend, 0);
    out.push({
      key: "wasted",
      title: `${wasted.length} anúncio${wasted.length > 1 ? "s" : ""} sem lead com gasto relevante`,
      text: `${brl.format(total)} investidos sem gerar nenhum lead (cada um com ${brl.format(MIN_SPEND_FOR_VERDICT)}+). Vale pausar ou revisar o criativo.`,
    });
  }

  const saturated = ads.filter((a) => a.m.spend >= 30 && frequency(a.m) > 3);
  if (saturated.length > 0) {
    out.push({
      key: "frequency",
      title: `${saturated.length} anúncio${saturated.length > 1 ? "s" : ""} com frequência acima de 3`,
      text: "A mesma pessoa está vendo o anúncio várias vezes — risco de saturação e de CPL subindo.",
    });
  }

  if (previous && cpl(totals) > 0 && cpl(previous) > 0) {
    const change = ((cpl(totals) - cpl(previous)) / cpl(previous)) * 100;
    if (Math.abs(change) >= 5) {
      out.push({
        key: "cplTrend",
        title: `CPL ${change > 0 ? "subiu" : "caiu"} ${Math.abs(change).toFixed(0)}% vs. período anterior`,
        text: `De ${brl.format(cpl(previous))} para ${brl.format(cpl(totals))} por lead.`,
      });
    }
  }

  const bestDay = [...weekday].filter((w) => w.samples > 0 && w.leads > 0).sort((a, b) => b.leads - a.leads)[0];
  if (bestDay) {
    out.push({
      key: "weekday",
      title: `Mais leads: ${bestDay.long}`,
      text: `Média de ${bestDay.leads.toFixed(1).replace(".", ",")} leads por ${bestDay.long} (CPL ${bestDay.cpl > 0 ? brl.format(bestDay.cpl) : "—"}).`,
    });
  }

  if (totals.clicks >= 50 && connectRate(totals) > 0 && connectRate(totals) < 70) {
    out.push({
      key: "funnel",
      title: `Só ${connectRate(totals).toFixed(0)}% dos cliques chegam à LP`,
      text: "Perda entre o clique no anúncio e a visita à página — confira velocidade de carregamento e o link do anúncio.",
    });
  }

  const bestCampaign = campaigns.filter((c) => c.m.leads > 0 && c.m.spend >= 20).sort((a, b) => cpl(a.m) - cpl(b.m))[0];
  if (bestCampaign) {
    out.push({
      key: "bestCampaign",
      title: "Campanha mais eficiente",
      text: `${bestCampaign.name} — ${brl.format(cpl(bestCampaign.m))} por lead com ${nf.format(bestCampaign.m.leads)} leads.`,
    });
  }

  return out;
}
