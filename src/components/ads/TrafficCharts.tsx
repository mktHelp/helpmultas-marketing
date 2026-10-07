"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, LineChart, Line } from "recharts";
import { GRID_COLOR, TOOLTIP_STYLE } from "@/lib/chart-theme";

// Mesma paleta/estilo de app/src/components/dashboard/DashboardCharts.tsx,
// reaproveitado aqui pros gráficos de Tráfego Pago.
const TICK_STYLE = { fontSize: 11, fill: "#7c8e98" };

function truncate(label: string, max = 22) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function TrafficBarChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue: (value: number) => string;
}) {
  if (!data.length) return <EmptyChart />;
  const chartData = data.map((d) => ({ ...d, shortLabel: truncate(d.label) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ left: -20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="shortLabel"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <RTooltip
          formatter={(value) => [formatValue(Number(value ?? 0)), ""]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="value" fill="#fcbf00" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrafficLineChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue: (value: number) => string;
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <RTooltip formatter={(value) => [formatValue(Number(value ?? 0)), ""]} contentStyle={TOOLTIP_STYLE} />
        <Line type="monotone" dataKey="value" stroke="#243746" strokeWidth={2.5} dot={{ r: 3, fill: "#fcbf00" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">Sem dados para exibir</div>;
}
