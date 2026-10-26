"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { shortDate } from "@/components/shared/dash-parts";
import {
  PERIOD_OPTIONS, periodLabel, rangeForPreset, rangeLength, shiftDate, todayBRT, type DateRange, type PeriodKey,
} from "@/lib/period";

// Seletor de período compartilhado pelas dashboards do Hub (inicial, Tarefas e
// Planejamento): mesmo preset, comparação com o período anterior e legenda.

export function usePeriod(initial: PeriodKey = "30") {
  const today = useMemo(() => todayBRT(), []);
  const [period, setPeriod] = useState<PeriodKey>(initial);
  const [custom, setCustom] = useState<DateRange>(() => ({ from: shiftDate(todayBRT(), -7), to: shiftDate(todayBRT(), -1) }));
  const range = useMemo(() => rangeForPreset(period, custom, today), [period, custom, today]);
  const length = rangeLength(range);
  const prevRange = useMemo(() => ({ from: shiftDate(range.from, -length), to: shiftDate(range.from, -1) }), [range, length]);
  const closed = range.to < today;
  const label = periodLabel(period, range);
  return { today, period, setPeriod, custom, setCustom, range, prevRange, length, closed, label };
}

export type PeriodState = ReturnType<typeof usePeriod>;

function DateField({ label, value, max, onChange }: { label: string; value: string; max?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
      {label}
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-9 rounded-[14px] border border-gray-200 bg-white px-3 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
    </label>
  );
}

export function PeriodControls({ p }: { p: PeriodState }) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
      {p.period === "custom" && (
        <div className="flex items-center gap-2">
          <DateField label="De" value={p.custom.from} max={p.today} onChange={(v) => p.setCustom((c) => ({ ...c, from: v }))} />
          <DateField label="Até" value={p.custom.to} max={p.today} onChange={(v) => p.setCustom((c) => ({ ...c, to: v }))} />
        </div>
      )}
      <div className="min-w-0 max-w-full overflow-x-auto">
        <Tabs tabs={PERIOD_OPTIONS} active={p.period} onChange={(k) => p.setPeriod(k as PeriodKey)} />
      </div>
    </div>
  );
}

export function PeriodCaption({ p }: { p: PeriodState }) {
  return (
    <p className="-mt-3 text-xs text-gray-500">
      <span className="font-semibold text-blue-900">
        {p.label}
        {p.period !== "custom" && p.length > 1 ? ` · ${shortDate(p.range.from)} a ${shortDate(p.range.to)}` : ""}
      </span>
      {!p.closed && " · o dia de hoje é parcial (sem comparação com período anterior)"}
      {p.closed && ` · comparado a ${shortDate(p.prevRange.from)}${p.length > 1 ? ` – ${shortDate(p.prevRange.to)}` : ""}`}
    </p>
  );
}
