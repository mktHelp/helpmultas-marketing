"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Copy, Megaphone, ShieldCheck, Target, UserX, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { BarList, ChartTooltip, Donut, Insight, Kpi, Panel, RTooltip, fmt, percent } from "@/components/shared/dash-parts";
import { BRAND, GRID_COLOR, TICK_STYLE } from "@/lib/chart-theme";
import type { IssueLead } from "@/lib/lead-reconciliation";
import { fmtDateTime, type Run } from "./shared";

const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD

function coverage(s: Run["summary"]) {
  const inCrm = (s.lp_in_crm ?? 0) + (s.native_in_crm ?? 0);
  const out = (s.lp_missing ?? 0) + (s.native_missing ?? 0);
  return inCrm + out ? (inCrm / (inCrm + out)) * 100 : 100;
}

export function ReconDashboard({ run, previous, runs, onOpen }: { run: Run; previous: Run | null; runs: Run[]; onOpen: (l: IssueLead) => void }) {
  const s = run.summary;
  const p = previous?.summary;
  const missing = useMemo(() => run.issues.missing ?? [], [run]);
  const totalOut = (s.lp_missing ?? 0) + (s.native_missing ?? 0);
  const totalDup = (s.dup_lp ?? 0) + (s.dup_native ?? 0) + (s.dup_crm ?? 0);
  const total = (s.lp_total ?? 0) + (s.native_total ?? 0);
  const cov = coverage(s);

  // Evolução: um ponto por ciclo bem-sucedido, do mais antigo pro mais novo.
  const trend = useMemo(
    () =>
      runs
        .filter((r) => r.status === "success")
        .slice()
        .reverse()
        .map((r) => ({
          label: fmtDateTime(r.started_at).slice(0, 5) + " " + fmtDateTime(r.started_at).slice(-5),
          tip: fmtDateTime(r.started_at),
          LP: r.summary.lp_missing ?? 0,
          Nativo: r.summary.native_missing ?? 0,
        })),
    [runs],
  );

  // Fora do CRM por dia em que o lead chegou.
  const byDay = useMemo(() => {
    const m = new Map<string, { LP: number; Nativo: number }>();
    for (const l of missing) {
      const k = dayKey(l.at);
      const cur = m.get(k) ?? { LP: 0, Nativo: 0 };
      if (l.source === "nativo") cur.Nativo++;
      else cur.LP++;
      m.set(k, cur);
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ label: `${k.slice(8, 10)}/${k.slice(5, 7)}`, ...v }));
  }, [missing]);

  const byOrigin = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of missing) m.set(l.origin || "Sem origem", (m.get(l.origin || "Sem origem") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  }, [missing]);

  const oldest = useMemo(() => missing.slice().sort((a, b) => a.at.localeCompare(b.at)).slice(0, 5), [missing]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cobertura do CRM" value={`${cov.toFixed(1)}%`} current={cov} previous={p ? coverage(p) : null} icon={ShieldCheck} color={BRAND.green} hint="leads da janela que chegaram ao CRM" />
        <Kpi label="Fora do CRM" value={fmt(totalOut)} current={totalOut} previous={p ? (p.lp_missing ?? 0) + (p.native_missing ?? 0) : null} invert icon={UserX} color={BRAND.red} hint={`${s.lp_missing ?? 0} LP · ${s.native_missing ?? 0} nativo`} />
        <Kpi label="Duplicados" value={fmt(totalDup)} current={totalDup} previous={p ? (p.dup_lp ?? 0) + (p.dup_native ?? 0) + (p.dup_crm ?? 0) : null} invert icon={Copy} color={BRAND.orange} hint={`${s.dup_crm ?? 0} no CRM · ${(s.dup_lp ?? 0) + (s.dup_native ?? 0)} na origem`} />
        <Kpi label="Leads na janela" value={fmt(total)} current={total} previous={p ? (p.lp_total ?? 0) + (p.native_total ?? 0) : null} icon={Users} color={BRAND.steel} hint={`${s.lp_total ?? 0} LP · ${s.native_total ?? 0} nativo · 7 dias`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Status dos leads" subtitle="Últimos 7 dias, LP + formulário nativo" className="lg:col-span-1">
          <Donut
            centerLabel="no CRM"
            centerValue={`${cov.toFixed(0)}%`}
            data={[
              { name: "No CRM", value: (s.lp_in_crm ?? 0) + (s.native_in_crm ?? 0), color: BRAND.green },
              { name: "Fora do CRM", value: totalOut, color: BRAND.red },
              { name: "Aguardando", value: (s.lp_pending ?? 0) + (s.native_pending ?? 0), color: BRAND.yellow },
            ]}
          />
        </Panel>
        <Panel title="Cobertura por origem" subtitle="Quanto de cada canal chegou ao CRM" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Landing Page", total: s.lp_total ?? 0, ok: s.lp_in_crm ?? 0, out: s.lp_missing ?? 0, wait: s.lp_pending ?? 0 },
              { label: "Formulário nativo", total: s.native_total ?? 0, ok: s.native_in_crm ?? 0, out: s.native_missing ?? 0, wait: s.native_pending ?? 0 },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl bg-gray-050 p-4">
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold text-blue-900">{c.label}</p>
                  <p className="font-display text-2xl font-bold text-blue-900">{percent(c.ok, c.ok + c.out, 0)}</p>
                </div>
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-gray-200">
                  <div style={{ width: `${c.total ? (c.ok / c.total) * 100 : 0}%`, background: BRAND.green }} />
                  <div style={{ width: `${c.total ? (c.wait / c.total) * 100 : 0}%`, background: BRAND.yellow }} />
                  <div style={{ width: `${c.total ? (c.out / c.total) * 100 : 0}%`, background: BRAND.red }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-gray-600">
                  <span>{c.ok} no CRM</span>
                  <span>{c.wait} aguardando</span>
                  <span className="font-semibold text-[color:var(--color-danger)]">{c.out} fora</span>
                  <span className="text-gray-400">de {c.total}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Evolução por ciclo" subtitle="Leads fora do CRM a cada validação (3h)">
          {trend.length > 1 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={TICK_STYLE} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RTooltip content={<ChartTooltip total />} />
                  <Area type="monotone" dataKey="LP" stackId="1" stroke={BRAND.yellow} fill={BRAND.yellow} fillOpacity={0.35} />
                  <Area type="monotone" dataKey="Nativo" stackId="1" stroke={BRAND.steel} fill={BRAND.steel} fillOpacity={0.35} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-gray-400">O gráfico aparece a partir do 2º ciclo.</p>
          )}
        </Panel>
        <Panel title="Fora do CRM por dia de entrada" subtitle="Dia em que o lead se cadastrou">
          {byDay.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={TICK_STYLE} tickLine={false} axisLine={false} />
                  <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RTooltip content={<ChartTooltip total />} cursor={{ fill: "rgba(36,55,70,0.04)" }} />
                  <Bar dataKey="LP" stackId="a" fill={BRAND.yellow} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Nativo" stackId="a" fill={BRAND.steel} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-gray-400">Nenhum lead fora do CRM 🎉</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Onde estão os leads perdidos" subtitle="Fora do CRM por anúncio / página" className="lg:col-span-2">
          <BarList items={byOrigin} total={totalOut} color={BRAND.red} />
        </Panel>
        <Panel title="Mais antigos sem CRM" subtitle="Clique para ver o lead">
          {oldest.length ? (
            <ul className="space-y-1">
              {oldest.map((l) => (
                <li key={`${l.source}-${l.id}`}>
                  <button type="button" onClick={() => onOpen(l)} className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left hover:bg-gray-050">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-blue-900">{l.name || l.phone || "Sem nome"}</span>
                      <span className="block truncate text-xs text-gray-500">{l.source === "nativo" ? "Form nativo" : "LP"} · {fmtDateTime(l.at)}</span>
                    </span>
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--color-danger)]" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Nada pendente.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Insight icon={totalOut ? Target : CheckCircle2} title={totalOut ? `${totalOut} leads para recuperar` : "CRM em dia"}>
          {totalOut
            ? `Ligue ou cadastre manualmente no CRM. ${byOrigin[0] ? `A maior concentração é em “${byOrigin[0].label.slice(0, 60)}”.` : ""}`
            : "Todos os leads da janela chegaram ao CRM ou ainda estão no prazo do próximo export."}
        </Insight>
        <Insight icon={Megaphone} title={`Nativo: ${percent(s.native_in_crm ?? 0, (s.native_in_crm ?? 0) + (s.native_missing ?? 0), 0)} no CRM`}>
          {s.native_error ? `Formulário nativo não sincronizou: ${s.native_error}` : `${s.native_total ?? 0} leads lidos direto da Meta nos últimos 7 dias.`}
        </Insight>
        <Insight icon={Copy} title={`${s.dup_crm ?? 0} grupos duplicados no CRM`}>
          Mesmo telefone ou e-mail com ids de CRM diferentes — vale unificar para não contar o lead duas vezes no funil.
        </Insight>
      </div>
    </div>
  );
}
