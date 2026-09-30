import { shiftDate, rangeLength, type DateRange } from "@/lib/period";

// Períodos da aba Relatórios: janelas maiores que as das dashboards (mês
// atual, mês passado, ano). Datas "YYYY-MM-DD" no fuso de São Paulo.

export type ReportPeriodKey = "7" | "30" | "90" | "month" | "lastMonth" | "year" | "custom";

export const REPORT_PERIOD_OPTIONS: { key: ReportPeriodKey; label: string }[] = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "month", label: "Este mês" },
  { key: "lastMonth", label: "Mês passado" },
  { key: "year", label: "Este ano" },
  { key: "custom", label: "Personalizado" },
];

export function isReportPeriodKey(v: string | undefined): v is ReportPeriodKey {
  return REPORT_PERIOD_OPTIONS.some((o) => o.key === v);
}

const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`;

function lastOfPreviousMonth(d: string) {
  return shiftDate(firstOfMonth(d), -1);
}

// Períodos terminam ontem (dias fechados), exceto quando o mês/ano acabou de
// começar e ontem cairia fora da janela.
export function reportRange(key: ReportPeriodKey, custom: DateRange, today: string): DateRange {
  const yesterday = shiftDate(today, -1);
  switch (key) {
    case "7":
    case "30":
    case "90":
      return { from: shiftDate(yesterday, -(Number(key) - 1)), to: yesterday };
    case "month": {
      const from = firstOfMonth(today);
      return { from, to: yesterday >= from ? yesterday : today };
    }
    case "lastMonth": {
      const to = lastOfPreviousMonth(today);
      return { from: firstOfMonth(to), to };
    }
    case "year": {
      const from = `${today.slice(0, 4)}-01-01`;
      return { from, to: yesterday >= from ? yesterday : today };
    }
    case "custom": {
      let { from, to } = custom;
      if (from > to) [from, to] = [to, from];
      if (to > today) to = today;
      if (from > to) from = to;
      return { from, to };
    }
  }
}

// Mesmo tamanho do período, imediatamente antes.
export function previousRange(range: DateRange): DateRange {
  const length = rangeLength(range);
  return { from: shiftDate(range.from, -length), to: shiftDate(range.from, -1) };
}

const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function reportPeriodLabel(key: ReportPeriodKey, range: DateRange): string {
  const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  if (key === "month" || key === "lastMonth") return `${MONTHS[Number(range.from.slice(5, 7)) - 1]} de ${range.from.slice(0, 4)}`;
  if (key === "year") return `Ano de ${range.from.slice(0, 4)}`;
  if (key === "custom") return range.from === range.to ? dmy(range.from) : `${dmy(range.from)} a ${dmy(range.to)}`;
  return `Últimos ${key} dias`;
}
