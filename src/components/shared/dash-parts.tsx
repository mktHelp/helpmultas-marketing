"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import { numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BRAND, GRID_COLOR, TICK_STYLE } from "@/lib/chart-theme";


const compactFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const fmt = (n: number) => numberFormatter.format(Math.round(n));
export const compact = (n: number) => compactFormatter.format(n);
export const signed = (n: number) => `${n > 0 ? "+" : ""}${numberFormatter.format(n)}`;

export function percent(part: number, total: number, digits = 1) {
  return total > 0 ? `${((part / total) * 100).toFixed(digits).replace(".", ",")}%` : "0%";
}

export function shortDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function tipDate(date: string) {
  const wd = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  return `${wd}, ${shortDate(date)}`;
}

export function Panel({
  title,
  subtitle,
  action,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** ícone no encaixe com bordas invertidas (canto superior direito) */
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn("p-5", className)}
      notch={
        Icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-blue-900 text-yellow-500">
            <Icon className="h-4 w-4" />
          </span>
        ) : undefined
      }
    >
      <div className={cn("flex flex-wrap items-start justify-between gap-2", Icon && "pr-12")}>
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold text-blue-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
        active
          ? "border-blue-900 bg-blue-900 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-blue-900"
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

// invert: pra custos (CPL, CPC...) subir é ruim — inverte as cores.
export function DeltaBadge({ current, previous, invert }: { current: number; previous: number | null; invert?: boolean }) {
  if (previous == null) return null;
  if (previous === 0 && current === 0) return null;
  const change = previous === 0 ? 100 : ((current - previous) / Math.abs(previous)) * 100;
  const flat = Math.abs(change) < 0.5;
  const up = change > 0;
  const good = invert ? !up : up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
        flat && "bg-gray-100 text-gray-500",
        !flat && good && "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
        !flat && !good && "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]"
      )}
      title="Variação em relação ao período anterior"
    >
      <Icon className="h-3 w-3" />
      {Math.abs(change) >= 1000 ? ">999" : Math.abs(change).toFixed(flat ? 0 : change < 10 ? 1 : 0).replace(".", ",")}%
    </span>
  );
}

export function Kpi({
  label,
  value,
  current,
  previous,
  hint,
  spark,
  color = BRAND.blue,
  icon: Icon,
  onClick,
  active,
  invert,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number | null;
  hint?: string;
  spark?: number[];
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  active?: boolean;
  invert?: boolean;
}) {
  return (
    <Card
      onClick={onClick}
      notch={
        Icon ? (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[10px]"
            style={{ backgroundColor: active ? color : `${color}1f`, color: active ? "#fff" : color === BRAND.yellow ? "#a87f00" : color }}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : undefined
      }
      className={cn(
        "flex min-h-[104px] flex-col overflow-hidden p-4 transition-shadow",
        onClick && "cursor-pointer hover:shadow-[var(--shadow-md)]"
      )}
    >
      <p className={cn("truncate text-xs font-semibold text-gray-500", Icon && "pr-12")}>{label}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="font-display text-2xl font-semibold leading-none tracking-tight text-blue-900 tabular-nums">{value}</p>
        {current != null && <DeltaBadge current={current} previous={previous ?? null} invert={invert} />}
      </div>
      {hint && <p className="mt-1.5 truncate text-[11px] text-gray-400">{hint}</p>}
      {spark && spark.length > 1 && (
        <div className="-mx-4 -mb-4 mt-auto h-9 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* filtro ativo: traço na base */}
      {active && <span className="absolute inset-x-4 bottom-0 h-[3px] rounded-t-full" style={{ backgroundColor: color }} aria-hidden />}
    </Card>
  );
}

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: { tip?: string };
}

// Tooltip padrão dos gráficos: título (data) + uma linha por série.
export function ChartTooltip({
  active,
  payload,
  label,
  format = fmt,
  total,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  format?: (n: number) => string;
  total?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const sum = payload.reduce((s, p) => s + Number(p.value ?? 0), 0);
  return (
    <div className="min-w-[140px] rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-xs shadow-[var(--shadow-md)]">
      <p className="mb-1.5 border-b border-gray-100 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">{payload[0]?.payload?.tip ?? label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center justify-between gap-4 text-gray-700">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px]" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums text-blue-900">{format(Number(p.value ?? 0))}</span>
        </p>
      ))}
      {total && payload.length > 1 && (
        <p className="mt-1 flex justify-between border-t border-gray-100 pt-1 font-bold text-blue-900">
          <span>Total</span>
          <span>{format(sum)}</span>
        </p>
      )}
    </div>
  );
}

export { RTooltip };

export interface Slice {
  name: string;
  value: number;
  color: string;
}

// Rosca com valor central + legenda clicável (passar o mouse destaca a fatia).
export function Donut({
  data,
  centerLabel,
  centerValue,
  format = fmt,
}: {
  data: Slice[];
  centerLabel?: string;
  centerValue?: string;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">Sem dados</div>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[168px] w-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              innerRadius={64}
              outerRadius={80}
              paddingAngle={1.5}
              cornerRadius={3}
              stroke="none"
              onMouseEnter={(_, i) => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {items.map((d, i) => (
                <Cell key={d.name} fill={d.color} opacity={hover == null || hover === i ? 1 : 0.35} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-display text-xl font-semibold tabular-nums text-blue-900">
            {hover != null ? percent(items[hover].value, total, 0) : (centerValue ?? compact(total))}
          </p>
          <p className="max-w-[90px] text-[11px] leading-tight text-gray-500">
            {hover != null ? items[hover].name : (centerLabel ?? "total")}
          </p>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-1.5">
        {items.map((d, i) => (
          <li
            key={d.name}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-[13px] transition-colors",
              hover === i && "bg-gray-050"
            )}
          >
            <span className="flex items-center gap-2 font-semibold text-blue-900">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="text-gray-700">
              {format(d.value)} <span className="text-xs text-gray-400">· {percent(d.value, total, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Barras horizontais em HTML puro (ranking de cidades, tipos etc.).
export function BarList({
  items,
  format = fmt,
  color = BRAND.yellow,
  total,
}: {
  items: { label: string; value: number; color?: string; hint?: string }[];
  format?: (n: number) => string;
  color?: string;
  total?: number;
}) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (!items.length) return <p className="text-sm text-gray-400">Sem dados.</p>;
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="truncate font-semibold text-blue-900">{it.label}</span>
            <span className="shrink-0 text-gray-700">
              {format(it.value)}
              {total ? <span className="text-xs text-gray-400"> · {percent(it.value, total, 0)}</span> : null}
              {it.hint ? <span className="text-xs text-gray-400"> · {it.hint}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${max ? (it.value / max) * 100 : 0}%`, background: it.color ?? color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Insight({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-050 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-yellow-100">
        <Icon className="h-4 w-4 text-blue-900" />
      </div>
      <div>
        <p className="text-sm font-bold text-blue-900">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-gray-600">{children}</p>
      </div>
    </div>
  );
}

export { TICK_STYLE, GRID_COLOR, BRAND };
