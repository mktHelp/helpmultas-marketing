"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell,
} from "recharts";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabase/client";
import { listFollowerSnapshotsInRange } from "@/lib/services/social";
import { dailyFollowerHistory } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { SocialAccount } from "@/types/database";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

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
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ReturnType<typeof dailyFollowerHistory>>([]);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    const { start, end } = monthRange(year, month);
    listFollowerSnapshotsInRange(supabase, account.id, start, end)
      .then((snapshots) => setHistory(dailyFollowerHistory(snapshots)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, year, month]);

  const summary = useMemo(() => {
    if (history.length === 0) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const gained = history.reduce((sum, d) => sum + (d.delta && d.delta > 0 ? d.delta : 0), 0);
    const lost = history.reduce((sum, d) => sum + (d.delta && d.delta < 0 ? -d.delta : 0), 0);
    return { start: first.followers, end: last.followers, net: last.followers - first.followers, gained, lost };
  }, [history]);

  const years = [now.getFullYear(), now.getFullYear() - 1];

  return (
    <Dialog open={!!account} onClose={onClose} size="xl">
      <DialogHeader
        title="Histórico de seguidores"
        subtitle={account ? `@${account.label}` : undefined}
        onClose={onClose}
      />
      <DialogBody className="space-y-5">
        <div className="flex items-center gap-2">
          <Select className="w-40" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </Select>
          <Select className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>

        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Início do mês" value={summary.start.toLocaleString("pt-BR")} />
            <SummaryStat label="Atual" value={summary.end.toLocaleString("pt-BR")} />
            <SummaryStat
              label="Saldo no mês"
              value={`${summary.net > 0 ? "+" : ""}${summary.net.toLocaleString("pt-BR")}`}
              tone={summary.net > 0 ? "success" : summary.net < 0 ? "danger" : undefined}
              icon={summary.net > 0 ? TrendingUp : summary.net < 0 ? TrendingDown : undefined}
            />
            <SummaryStat label="Ganhos / Perdas" value={`+${summary.gained} / -${summary.lost}`} />
          </div>
        )}

        <div>
          {loading ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">Carregando...</div>
          ) : history.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
              Sem registros para este mês.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
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
          )}
        </div>

        {history.length > 0 && (
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
        )}
      </DialogBody>
    </Dialog>
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
