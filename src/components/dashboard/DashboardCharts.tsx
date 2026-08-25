"use client";

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";

const BRAND_COLORS = ["#243746", "#fcbf00", "#4a6a80", "#e0a900", "#7c8e98", "#375367", "#2c4356", "#b7c3ca"];

export function AreaDonutChart({ data }: { data: { name: string; count: number; color: string }[] }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={d.color || BRAND_COLORS[i % BRAND_COLORS.length]} />
          ))}
        </Pie>
        <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid #d8e0e4", fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StatusBarChart({ data }: { data: { label: string; count: number }[] }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f4" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7c8e98" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#7c8e98" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid #d8e0e4", fontSize: 13 }} />
        <Bar dataKey="count" fill="#fcbf00" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProductivityLineChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f4" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7c8e98" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#7c8e98" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid #d8e0e4", fontSize: 13 }} />
        <Line type="monotone" dataKey="count" stroke="#243746" strokeWidth={2.5} dot={{ r: 3, fill: "#fcbf00" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">Sem dados para exibir</div>;
}
