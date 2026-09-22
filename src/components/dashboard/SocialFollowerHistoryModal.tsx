"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell,
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
      <DialogBody className="space-y-6">
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

        {loading ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Carregando...</div>
        ) : (
          sortedMonths.map((m, i) => (
            <MonthReport
              key={m}
              month={m}
              color={MONTH_COLORS[i % MONTH_COLORS.length]}
              history={histories[m] || []}
              showLabel={sortedMonths.length > 1}
            />
          ))
        )}
      </DialogBody>
    </Dialog>
  );
}

function MonthReport({
  month,
  color,
  history,
  showLabel,
}: {
  month: number;
  color: string;
  history: MonthHistory;
  showLabel: boolean;
}) {
  if (history.length === 0) {
    return (
      <div>
        {showLabel && <MonthLabel month={month} color={color} />}
        <div className="flex h-[160px] items-center justify-center text-sm text-gray-400">
          Sem registros para {MONTHS[month]}.
        </div>
      </div>
    );
  }

  const first = history[0];
  const last = history[history.length - 1];
  const gained = history.reduce((sum, d) => sum + (d.delta && d.delta > 0 ? d.delta : 0), 0);
  const lost = history.reduce((sum, d) => sum + (d.delta && d.delta < 0 ? -d.delta : 0), 0);
  const net = last.followers - first.followers;

  return (
    <div className="space-y-5">
      {showLabel && <MonthLabel month={month} color={color} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Início do mês" value={first.followers.toLocaleString("pt-BR")} />
        <SummaryStat label="Atual" value={last.followers.toLocaleString("pt-BR")} />
        <SummaryStat
          label="Saldo no mês"
          value={`${net > 0 ? "+" : ""}${net.toLocaleString("pt-BR")}`}
          tone={net > 0 ? "success" : net < 0 ? "danger" : undefined}
          icon={net > 0 ? TrendingUp : net < 0 ? TrendingDown : undefined}
        />
        <SummaryStat label="Ganhos / Perdas" value={`+${gained} / -${lost}`} />
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={history} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7c8e98" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#7c8e98" }}
            axisLine={false}
            tickLine={false}
            domain={["dataMin - 20", "dataMax + 20"]}
          />
          <RTooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #d8e0e4", fontSize: 13 }}
            formatter={(value, _name, props) => {
              const delta = (props?.payload as { delta?: number | null } | undefined)?.delta;
              return [
                `${Number(value).toLocaleString("pt-BR")}${delta != null ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}`,
                "Seguidores",
              ];
            }}
          />
          <Bar dataKey="followers" radius={[6, 6, 0, 0]}>
            {history.map((d) => (
              <Cell key={d.date} fill={d.delta == null || d.delta >= 0 ? "#fcbf00" : "#243746"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-050 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Dia</th>
              <th className="px-3 py-2 text-right font-semibold">Seguidores</th>
              <th className="px-3 py-2 text-right font-semibold">Variação</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((d) => (
              <tr key={d.date} className="border-t border-gray-100">
                <td className="px-3 py-2 text-blue-900">{d.label}</td>
                <td className="px-3 py-2 text-right font-semibold text-blue-900">
                  {d.followers.toLocaleString("pt-BR")}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold",
                    d.delta == null ? "text-gray-400" : d.delta > 0 ? "text-[color:var(--color-success)]" : d.delta < 0 ? "text-[color:var(--color-danger)]" : "text-gray-400"
                  )}
                >
                  {d.delta == null ? "—" : `${d.delta > 0 ? "+" : ""}${d.delta}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MonthLabel({ month, color }: { month: number; color: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-gray-100 pt-5 first:border-0 first:pt-0">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <h4 className="font-display text-sm font-semibold text-blue-900">{MONTHS[month]}</h4>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  icon?: typeof TrendingUp;
}) {
  return (
    <div className="rounded-xl bg-gray-050 p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p
        className={cn(
          "mt-1 flex items-center gap-1 text-lg font-bold",
          tone === "success" ? "text-[color:var(--color-success)]" : tone === "danger" ? "text-[color:var(--color-danger)]" : "text-blue-900"
        )}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {value}
      </p>
    </div>
  );
}
