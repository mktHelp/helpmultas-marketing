// Períodos do seletor (Hoje/Ontem/7/14/30/60/Personalizado) compartilhados
// pelas dashboards do Instagram e do Tráfego Pago.
// Datas são strings "YYYY-MM-DD" no fuso de São Paulo (mesmo do sync).

export type PeriodKey = "today" | "yesterday" | "7" | "14" | "30" | "60" | "custom";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7", label: "7 dias" },
  { key: "14", label: "14 dias" },
  { key: "30", label: "30 dias" },
  { key: "60", label: "60 dias" },
  { key: "custom", label: "Personalizado" },
];

export interface DateRange {
  from: string;
  to: string;
}

const BRT_OFFSET_MS = 3 * 3600 * 1000;

export function todayBRT(): string {
  return new Date(Date.now() - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

export function shiftDate(date: string, delta: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function isPeriodKey(v: string | undefined): v is PeriodKey {
  return PERIOD_OPTIONS.some((o) => o.key === v);
}

export function isDateKey(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// Presets de N dias terminam ontem (dias fechados); "hoje" é parcial.
export function rangeForPreset(key: PeriodKey, custom: DateRange, today = todayBRT()): DateRange {
  if (key === "today") return { from: today, to: today };
  if (key === "yesterday") {
    const y = shiftDate(today, -1);
    return { from: y, to: y };
  }
  if (key === "custom") {
    let { from, to } = custom;
    if (from > to) [from, to] = [to, from];
    if (to > today) to = today;
    if (from > to) from = to;
    return { from, to };
  }
  const days = Number(key);
  const yesterday = shiftDate(today, -1);
  return { from: shiftDate(yesterday, -(days - 1)), to: yesterday };
}

export function rangeLength(r: DateRange) {
  return Math.round((Date.parse(`${r.to}T12:00:00Z`) - Date.parse(`${r.from}T12:00:00Z`)) / 86400000) + 1;
}

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function periodLabel(key: PeriodKey, r: DateRange): string {
  if (key === "today") return `Hoje (${dm(r.from)})`;
  if (key === "yesterday") return `Ontem (${dm(r.from)})`;
  if (key === "custom") return r.from === r.to ? dm(r.from) : `${dm(r.from)} a ${dm(r.to)}`;
  return `Últimos ${key} dias`;
}

