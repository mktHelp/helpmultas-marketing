"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from "recharts";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { createClient } from "@/lib/supabase/client";
import { listFollowerSnapshotsInRange } from "@/lib/services/social";
import { dailyFollowerHistory } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { SocialAccount } from "@/types/database";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_COLORS = ["#fcbf00", "#243746", "#4a6a80", "#e0a900", "#7c8e98", "#a23b3b"];

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

type MonthHistory = ReturnType<typeof dailyFollowerHistory>;

export function SocialFollowerHistoryModal({
  account,
  onClose,
}: {
  account: SocialAccount | null;
  onClose: () => void;
}) {
  const supabase = createClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [months, setMonths] = useState<number[]>([now.getMonth()]);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [histories, setHistories] = useState<Record<number, MonthHistory>>({});
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!account || months.length === 0) return;
    setLoading(true);
    Promise.all(
      months.map(async (m) => {
        const { start, end } = monthRange(year, m);
        const snapshots = await listFollowerSnapshotsInRange(supabase, account.id, start, end);
        return [m, dailyFollowerHistory(snapshots)] as const;
      })
    )
      .then((entries) => setHistories(Object.fromEntries(entries)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, year, months]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setMonthPickerOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const sortedMonths = [...months].sort((a, b) => a - b);

  const summaries = useMemo(() => {
    return sortedMonths
      .map((m) => {
        const history = histories[m];
        if (!history || history.length === 0) return null;
        const first = history[0];
        const last = history[history.length - 1];
        const gained = history.reduce((sum, d) => sum + (d.delta && d.delta > 0 ? d.delta : 0), 0);
        const lost = history.reduce((sum, d) => sum + (d.delta && d.delta < 0 ? -d.delta : 0), 0);
        return {
          month: m,
          label: MONTHS_SHORT[m],
          color: MONTH_COLORS[sortedMonths.indexOf(m) % MONTH_COLORS.length],
          start: first.followers,
          end: last.followers,
          net: last.followers - first.followers,
          gained,
          lost,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [sortedMonths, histories]);

  // One row per day-of-month (01..31), one column per selected month, so
  // months line up side by side for comparison in the grouped bar chart.
  const chartData = useMemo(() => {
    const dayCount = Math.max(1, ...sortedMonths.map((m) => new Date(year, m + 1, 0).getDate()));
    return Array.from({ length: dayCount }, (_, i) => {
      const day = i + 1;
      const dayLabel = String(day).padStart(2, "0");
      const row: Record<string, number | string> = { day: dayLabel };
      for (const m of sortedMonths) {
        const history = histories[m] || [];
        const entry = history.find((d) => Number(d.date.slice(-2)) === day);
        if (entry) row[MONTHS_SHORT[m]] = entry.followers;
      }
      return row;
    });
  }, [sortedMonths, histories, year]);

  const hasData = sortedMonths.some((m) => (histories[m] || []).length > 0);
  const years = [now.getFullYear(), now.getFullYear() - 1];

  function toggleMonth(m: number) {
    setMonths((prev) => {
      if (prev.includes(m)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== m);
      }
      return [...prev, m];
    });
  }

  return (
    <Dialog open={!!account} onClose={onClose} size="xl">
      <DialogHeader
        title="Histórico de seguidores"
        subtitle={account ? `@${account.label}` : undefined}
        onClose={onClose}
      />
      <DialogBody className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setMonthPickerOpen((v) => !v)}
              className={cn(
                "flex h-10 w-48 items-center justify-between rounded-[14px] border bg-white px-3.5 text-sm text-blue-900",
                monthPickerOpen ? "border-yellow-500 ring-2 ring-yellow-500" : "border-gray-200"
              )}
            >
              <span className="truncate">
                {sortedMonths.length === 1
                  ? MONTHS[sortedMonths[0]]
                  : sortedMonths.map((m) => MONTHS_SHORT[m]).join(", ")}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
            </button>
            {monthPickerOpen && (
              <div className="absolute left-0 top-11 z-20 w-48 rounded-[14px] border border-gray-200 bg-white p-1.5 shadow-[var(--shadow-lg)]">
                {MONTHS.map((m, i) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-blue-900 hover:bg-gray-050"
                  >
                    <Checkbox checked={months.includes(i)} onChange={() => toggleMonth(i)} />
                    {m}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Select className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>

        {summaries.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {summaries.map((s) => (
              <div key={s.month} className="min-w-[190px] flex-1 rounded-xl bg-gray-050 p-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <p className="text-xs font-semibold text-gray-500">{MONTHS[s.month]}</p>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-blue-900">{s.end.toLocaleString("pt-BR")}</span>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-xs font-bold",
                      s.net > 0 ? "text-[color:var(--color-success)]" : s.net < 0 ? "text-[color:var(--color-danger)]" : "text-gray-400"
                    )}
                  >
                    {s.net > 0 ? <TrendingUp className="h-3 w-3" /> : s.net < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {s.net > 0 ? "+" : ""}
                    {s.net}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  +{s.gained} / -{s.lost} no mês
                </p>
              </div>
            ))}
          </div>
        )}

        <div>
          {loading ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">Carregando...</div>
          ) : !hasData ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
              Sem registros para o período selecionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ left: -20, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f4" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#7c8e98" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#7c8e98" }}
                  axisLine={false}
                  tickLine={false}
                  domain={["dataMin - 20", "dataMax + 20"]}
                />
                <RTooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #d8e0e4", fontSize: 13 }}
                  formatter={(value, name) => [Number(value).toLocaleString("pt-BR"), name]}
                  labelFormatter={(label) => `Dia ${label}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "#7c8e98" }}
                  formatter={(value) => MONTHS[MONTHS_SHORT.indexOf(value)] || value}
                />
                {sortedMonths.map((m, i) => (
                  <Bar
                    key={m}
                    dataKey={MONTHS_SHORT[m]}
                    fill={MONTH_COLORS[i % MONTH_COLORS.length]}
                    radius={[6, 6, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {hasData && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-050 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Dia</th>
                  {sortedMonths.map((m) => (
                    <th key={m} className="px-3 py-2 text-right font-semibold">{MONTHS_SHORT[m]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...chartData].reverse().map((row) => (
                  <tr key={row.day as string} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-blue-900">{row.day}</td>
                    {sortedMonths.map((m) => (
                      <td key={m} className="px-3 py-2 text-right font-semibold text-blue-900">
                        {row[MONTHS_SHORT[m]] != null ? Number(row[MONTHS_SHORT[m]]).toLocaleString("pt-BR") : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogBody>
    </Dialog>
  );
}
