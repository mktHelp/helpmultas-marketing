"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ReferenceLine, XAxis, YAxis } from "recharts";
import { CENARIOS, PERIODOS, brl, brlShort, calc, credPct, num, tot, type DreInput, type DreResult } from "@/lib/expansion/dre";

// Relatório em PDF (A4 retrato). Largura fixa de 190 mm (área útil com margem de 10 mm)
// e gráficos com tamanho em pixels: o que aparece na tela é exatamente o que imprime.
const W = 718;
// 277 mm (A4 menos margens) com folga de ~1% pra nunca estourar pra uma folha extra.
const PAGE_H = 1000;
const NAVY = "#243746";
const YELLOW = "#fcbf00";
const GREEN = "#2f8f5b";
const RED = "#c23b3b";
const MUTED = "#6b7f8c";

const pct1 = (n: number) => n.toFixed(1).replace(".", ",");

function Page({ title, S, n, total, children }: { title: string; S: DreInput; n: number; total: number; children: ReactNode }) {
  return (
    <section className="flex flex-col overflow-hidden break-after-page break-inside-avoid last:break-after-auto" style={{ width: W, height: PAGE_H }}>
      <div className="mb-3 flex shrink-0 items-center justify-between border-b border-gray-200 pb-2 text-[10px] text-gray-500">
        <span className="font-bold uppercase tracking-wider text-blue-900">DRE do Franqueado{S.lead ? ` · ${S.lead}` : ""}</span>
        <span>{title}</span>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      <div className="mt-3 flex shrink-0 justify-between border-t border-gray-200 pt-2 text-[9px] text-gray-400">
        <span>Help Multas · Expansão — projeção de viabilidade, não garante resultados.</span>
        <span>Página {n} de {total}</span>
      </div>
    </section>
  );
}

function H({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-2 mt-5 flex items-baseline justify-between first:mt-0">
      <h3 className="font-display text-[13px] font-bold text-blue-900">{children}</h3>
      {sub && <span className="text-[10px] text-gray-500">{sub}</span>}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "navy" | "yellow" }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tone === "navy" ? "border-blue-900 bg-blue-900 text-white" : tone === "yellow" ? "border-yellow-500 bg-yellow-500 text-blue-900" : "border-gray-200 bg-white text-blue-900"}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="font-display text-[19px] font-bold leading-tight">{value}</div>
      <div className="text-[9px] opacity-70">{sub}</div>
    </div>
  );
}

const axisMoney = (v: number) => brlShort(v).replace("R$ ", "");

function MonthlyChart({ c }: { c: DreResult }) {
  return (
    <AreaChart width={W} height={210} data={c.meses} margin={{ left: 0, right: 12, top: 18, bottom: 0 }}>
      <CartesianGrid stroke="#e6ecf0" vertical={false} />
      <XAxis dataKey="m" tick={{ fontSize: 9 }} tickLine={false} interval={2} />
      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={48} tickFormatter={axisMoney} />
      <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
      <Area isAnimationActive={false} type="monotone" dataKey="margem" name="Margem (após taxa de processamento e impostos)" stroke={YELLOW} fill={YELLOW} fillOpacity={0.2} strokeWidth={2} />
      <Area isAnimationActive={false} type="monotone" dataKey="resultado" name="Resultado líquido" stroke={NAVY} fill={NAVY} fillOpacity={0.06} strokeWidth={2} />
      {c.pay && <ReferenceLine x={c.pay} stroke={GREEN} strokeDasharray="4 4" label={{ value: `Retorno: mês ${c.pay}`, fill: GREEN, fontSize: 9, position: "top" }} />}
    </AreaChart>
  );
}

function CashChart({ c }: { c: DreResult }) {
  return (
    <AreaChart width={W} height={210} data={c.meses} margin={{ left: 0, right: 12, top: 18, bottom: 0 }}>
      <CartesianGrid stroke="#e6ecf0" vertical={false} />
      <XAxis dataKey="m" tick={{ fontSize: 9 }} tickLine={false} interval={2} />
      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={48} tickFormatter={axisMoney} />
      <ReferenceLine y={0} stroke={NAVY} />
      {c.pay && <ReferenceLine x={c.pay} stroke={GREEN} strokeDasharray="4 4" label={{ value: `Retorno: mês ${c.pay}`, fill: GREEN, fontSize: 9, position: "top" }} />}
      <Area isAnimationActive={false} type="monotone" dataKey="saldo" name="Saldo acumulado" stroke={NAVY} fill={NAVY} fillOpacity={0.14} strokeWidth={2} />
    </AreaChart>
  );
}

function YearChart({ c }: { c: DreResult }) {
  const data = PERIODOS.map((n) => {
    const r = c.meses.slice(0, n);
    return { ano: `${n} meses`, Faturamento: Math.round(tot(r, "faturamento")), Resultado: Math.round(tot(r, "resultado")) };
  });
  return (
    <BarChart width={W / 2 - 8} height={190} data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
      <CartesianGrid stroke="#e6ecf0" vertical={false} />
      <XAxis dataKey="ano" tick={{ fontSize: 9 }} tickLine={false} />
      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={44} tickFormatter={axisMoney} />
      <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
      <Bar isAnimationActive={false} dataKey="Faturamento" fill={NAVY} radius={[5, 5, 0, 0]} label={{ position: "top", fontSize: 8, fill: NAVY, formatter: (v: unknown) => axisMoney(Number(v)) }} />
      <Bar isAnimationActive={false} dataKey="Resultado" fill={YELLOW} radius={[5, 5, 0, 0]} label={{ position: "top", fontSize: 8, fill: "#8a6a00", formatter: (v: unknown) => axisMoney(Number(v)) }} />
    </BarChart>
  );
}

function Hundred({ c }: { c: DreResult }) {
  const fat = tot(c.meses, "faturamento");
  const parts = [
    { n: "Taxa de processamento", v: tot(c.meses, "roy"), color: "#9db0bc" },
    { n: "Impostos", v: tot(c.meses, "imp"), color: "#4a6a80" },
    { n: "Despesas fixas", v: tot(c.meses, "fixa"), color: NAVY },
    { n: "Resultado líquido", v: Math.max(tot(c.meses, "resultado"), 0), color: YELLOW },
  ];
  const T = parts.reduce((s, x) => s + x.v, 0) || 1;
  return (
    <div style={{ width: W / 2 - 8 }}>
      <div className="mb-3 flex h-4 overflow-hidden rounded-full bg-gray-100">
        {parts.map((x) => <div key={x.n} style={{ width: `${(x.v / T) * 100}%`, background: x.color }} />)}
      </div>
      <div className="space-y-2">
        {parts.map((x) => (
          <div key={x.n} className="flex items-center gap-2 text-[11px]">
            <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: x.color }} />
            <span className="flex-1 text-blue-900">{x.n}</span>
            <b className="text-blue-900">{Math.round((x.v / T) * 100)}%</b>
            <span className="w-16 text-right text-[10px] text-gray-500">{brlShort(x.v)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-yellow-050 px-3 py-2 text-[11px] text-blue-900">
        {fat > 0 ? <>De cada R$ 100 faturados, <b>R$ {Math.round((tot(c.meses, "resultado") / fat) * 100)}</b> ficam com o franqueado.</> : "Sem faturamento."}
      </p>
    </div>
  );
}

function Funnel({ c, S }: { c: DreResult; S: DreInput }) {
  const rows = [
    { n: "Círculo", leads: c.leadsCirculo, conv: S.convCirculo, cli: c.casosCirculo, col: "#9db0bc" },
    { n: "Parceiros", leads: c.leadsParceiros, conv: S.convParceiros, cli: c.casosParceiros, col: "#6f93ab" },
    { n: "Marketing", leads: c.leadsMkt, conv: S.convMkt, cli: c.casosMkt, col: YELLOW },
  ];
  const mx = Math.max(1, ...rows.map((r) => r.leads));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.n}>
          <div className="mb-0.5 flex justify-between text-[10px]"><span className="font-semibold">{r.n}</span><span><b>{pct1(r.leads)}</b> leads × {r.conv}% = <b>{pct1(r.cli)}</b> clientes</span></div>
          <div className="h-2.5 rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${Math.max((r.leads / mx) * 100, 1.5)}%`, background: r.col }} /></div>
        </div>
      ))}
      <p className="pt-1 text-[10px] text-gray-500">Por mês, no ritmo máximo: <b>{pct1(c.leadsMes)}</b> leads viram <b>{pct1(c.casosMes)}</b> clientes.</p>
    </div>
  );
}

function ItemsTable({ title, items, total }: { title: string; items: { n: string; v: number }[]; total: number }) {
  return (
    <div style={{ width: W / 2 - 8 }}>
      <H>{title}</H>
      <table className="w-full text-[10.5px] text-blue-900">
        <tbody>
          {items.map((x, i) => (
            <tr key={i} className="border-b border-gray-100"><td className="py-1">{x.n}</td><td className="py-1 text-right">{brl(+x.v || 0)}</td></tr>
          ))}
          <tr className="font-bold"><td className="pt-1.5">Total</td><td className="pt-1.5 text-right">{brl(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function DreReport({ S, c }: { S: DreInput; c: DreResult }) {
  const fat = tot(c.meses, "faturamento");
  const res = tot(c.meses, "resultado");
  const ys = PERIODOS.map((n) => c.meses.slice(0, n));
  const TOTAL = 4;
  const emitido = new Date().toLocaleDateString("pt-BR");
  const premissas: [string, string][] = [
    ["Pessoas no círculo", num(c.mercado)],
    ["Credibilidade", `${credPct(S)}% do círculo em 12 meses`],
    ["Leads/mês do círculo", `${pct1(c.leadsCirculo)} · conversão ${S.convCirculo}%`],
    ["Parceiros × indicações/mês", `${S.parceiros} × ${pct1(S.indicPorParceiro)} = ${pct1(c.leadsParceiros)} · conversão ${S.convParceiros}%`],
    ["Leads/mês do marketing", `${pct1(c.leadsMkt)} · conversão ${S.convMkt}%`],
    ["Clientes/mês (ritmo máximo)", pct1(c.casosMes)],
    ["Ritmo máximo em", `${S.rampa} meses`],
    ["Ticket médio", brl(c.ticket)],
    ["Taxa de processamento / impostos", `${S.royalties}% / ${S.imposto}%`],
    ["Despesas fixas / mês", brl(c.fixa)],
  ];
  const line = (label: string, k: "faturamento" | "roy" | "imp" | "margem" | "fixa" | "resultado", kind: "n" | "t" | "r" = "n", neg = false) => (
    <tr className={kind === "t" ? "bg-gray-100 font-bold" : kind === "r" ? "font-bold text-white" : ""} style={kind === "r" ? { background: NAVY } : undefined}>
      <td className={`px-2.5 py-1.5 ${kind === "n" ? "pl-5 text-gray-700" : ""}`}>{label}</td>
      {ys.map((y, i) => {
        const v = tot(y, k);
        return <td key={i} className="whitespace-nowrap px-2.5 py-1.5 text-right" style={v < 0 && kind !== "r" ? { color: RED } : undefined}>{brl(neg ? -v : v)}</td>;
      })}
    </tr>
  );

  return (
    <div className="mx-auto text-blue-900" style={{ width: W }}>
      <style>{"@page{size:A4 portrait;margin:10mm}html,body{background:#fff!important}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}"}</style>

      {/* ---------- Página 1: capa + resumo ---------- */}
      <Page title="Resumo executivo" S={S} n={1} total={TOTAL}>
        <div className="relative overflow-hidden rounded-2xl p-6 text-white" style={{ background: "linear-gradient(135deg,#243746,#2c5a73)" }}>
          <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full" style={{ background: "rgba(252,191,0,.18)" }} />
          <div className="relative flex items-start justify-between">
            <Image src="/logos/wordmark-white.png" alt="Help Multas" width={118} height={29} />
            <span className="rounded-full bg-yellow-500 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-900">Expansão</span>
          </div>
          <p className="relative mt-5 text-[10px] font-bold uppercase tracking-widest text-yellow-500">Projeção de viabilidade · 36 meses</p>
          <h1 className="relative mt-1 font-display text-[26px] font-bold leading-tight">
            {S.lead ? `${S.lead}, o` : "O"} investimento{" "}
            {c.pay ? <>volta no <span className="text-yellow-500">mês {c.pay}</span></> : <>passa de 36 meses de retorno</>}
          </h1>
          <p className="relative mt-2 text-[12px] leading-relaxed text-blue-100">
            Com um círculo de <b className="text-white">{num(c.mercado)} pessoas</b> {S.regiao !== "Brasil" ? `na região ${S.regiao} ` : ""}projetamos <b className="text-white">{pct1(c.casosMes)} clientes por mês</b> e um resultado líquido de <b className="text-white">{brl(c.pico.resultado)}/mês</b> a partir do mês {Math.min(S.rampa, 36)}.
          </p>
          <p className="relative mt-3 text-[9px] text-blue-200">Emitido em {emitido}</p>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2.5">
          <Kpi label="Investimento inicial" value={brl(c.inv)} sub="para abrir a operação" />
          <Kpi label="Retorno" value={c.pay ? `Mês ${c.pay}` : "> 36 meses"} sub="saldo acumulado positivo" tone="navy" />
          <Kpi label="Faturamento 36m" value={brlShort(fat)} sub="receita dos clientes" />
          <Kpi label="Lucro acumulado 36m" value={brlShort(res)} sub="já descontado tudo" tone="yellow" />
          <Kpi label="Margem líquida" value={`${fat ? pct1((res / fat) * 100) : 0}%`} sub="resultado ÷ faturamento" />
          <Kpi label="Retorno sobre o invest." value={c.roi36 !== null ? `${pct1(c.roi36)}×` : "—"} sub="lucro ÷ investimento" tone="navy" />
          <Kpi label="Ponto de equilíbrio" value={c.equilibrio !== null ? `${pct1(c.equilibrio)} clientes` : "—"} sub="por mês, p/ pagar despesas" />
          <Kpi label="Folga sobre o equilíbrio" value={c.folga !== null ? `${pct1(c.folga)}×` : "—"} sub="projeção ÷ equilíbrio" tone="yellow" />
        </div>

        <H sub="mesma operação, três cenários">E se der menos certo do que o esperado?</H>
        <div className="grid grid-cols-3 gap-2.5">
          {CENARIOS.map((x) => {
            const r = calc(S, x.ajuste);
            const tone = { conservador: ["#fb923c", "#fff4e8"], realista: [YELLOW, "#fff9e6"], otimista: [GREEN, "#e6f5ec"] }[x.id];
            return (
              <div key={x.id} className="rounded-xl border p-3" style={{ borderColor: tone[0], background: tone[1] }}>
                <div className="font-display text-[12px] font-bold">{x.label}</div>
                <div className="mb-2 text-[9px] leading-snug text-gray-500">{x.desc}</div>
                <div className="grid grid-cols-3 gap-1 text-[9px] text-gray-500">
                  <div>Retorno<b className="block font-display text-[13px] text-blue-900">{r.pay ? `Mês ${r.pay}` : ">36m"}</b></div>
                  <div>Resultado/mês<b className="block font-display text-[13px]" style={{ color: r.pico.resultado < 0 ? RED : NAVY }}>{brlShort(r.pico.resultado)}</b></div>
                  <div>Clientes/mês<b className="block font-display text-[13px] text-blue-900">{pct1(r.casosMes)}</b></div>
                </div>
              </div>
            );
          })}
        </div>

        <H sub="o que sustenta os números">Premissas utilizadas</H>
        <div className="grid grid-cols-2 gap-x-6 text-[10.5px]">
          {premissas.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-gray-100 py-1"><span className="text-gray-600">{k}</span><b>{v}</b></div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3 text-blue-900" style={{ background: "linear-gradient(90deg,#fcbf00,#fbbf24)" }}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-900 font-display text-[11px] font-bold text-yellow-500">60d</span>
          <p className="text-[11px]"><b className="font-display">Após 60 dias · recompra.</b> De 20% a 30% dos clientes voltam a comprar e indicam novos leads.</p>
        </div>
      </Page>

      {/* ---------- Página 2: gráficos ---------- */}
      <Page title="Evolução e distribuição" S={S} n={2} total={TOTAL}>
        <H sub="mensal, 36 meses">Margem e resultado</H>
        <MonthlyChart c={c} />
        <H sub={`após o investimento inicial de ${brl(c.inv)}`}>Saldo de caixa acumulado</H>
        <CashChart c={c} />
        <div className="mt-5 flex gap-4">
          <div>
            <H sub="acumulado, faturamento x resultado">Evolução em 12, 24 e 36 meses</H>
            <YearChart c={c} />
          </div>
          <div>
            <H sub="36 meses">Para onde vai cada R$ 100</H>
            <Hundred c={c} />
          </div>
        </div>
        <H sub="de onde vêm os clientes">Dos leads aos clientes</H>
        <Funnel c={c} S={S} />
      </Page>

      {/* ---------- Página 3: DRE ---------- */}
      <Page title="Demonstração do Resultado do Exercício" S={S} n={3} total={TOTAL}>
        <H sub="acumulado · Demonstração do Resultado do Exercício">DRE em 12, 24 e 36 meses</H>
        <table className="w-full border-collapse overflow-hidden rounded-lg text-[10.5px]">
          <thead>
            <tr className="border-b border-gray-200 text-[9.5px] text-gray-500">
              {["Descrição", "12 meses", "24 meses", "36 meses"].map((h, i) => <th key={h} className={`px-2.5 py-1.5 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {line("Faturamento (receita dos clientes)", "faturamento", "t")}
            {line("(-) Taxa de processamento", "roy", "n", true)}
            {line("(-) Impostos", "imp", "n", true)}
            {line("= Margem de contribuição", "margem", "t")}
            {line("(-) Despesas fixas", "fixa", "n", true)}
            {line("= Resultado líquido", "resultado", "r")}
          </tbody>
        </table>
        <div className="mt-5 flex gap-4">
          <ItemsTable title="Investimento inicial" items={S.invest} total={c.inv} />
          <ItemsTable title="Despesas fixas por mês" items={S.desp} total={c.fixa} />
        </div>
        <H>Como ler esta projeção</H>
        <ul className="list-disc space-y-1 pl-4 text-[10.5px] leading-relaxed text-gray-600">
          <li>O <b>retorno</b> é o primeiro mês em que o lucro acumulado supera o investimento inicial.</li>
          <li>O volume cresce linearmente até o ritmo máximo ({S.rampa} meses) e depois se mantém constante; não há reajuste de ticket nem de despesas.</li>
          <li>Ticket médio, investimento, despesas, taxa de processamento e impostos são os valores informados para este lead.</li>
          <li>Os cenários conservador e otimista variam em 40% e 30% os clientes vindos do círculo, dos parceiros e do marketing, mantendo todo o resto igual.</li>
          <li>Trata-se de uma simulação com as premissas informadas pelo lead; <b>não é promessa de resultado</b>.</li>
        </ul>
      </Page>

      {/* ---------- Página 4: fluxo mensal ---------- */}
      <Page title="Fluxo de caixa mensal" S={S} n={4} total={TOTAL}>
        <H sub="36 meses">Fluxo de caixa mensal</H>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-gray-300 text-[9px] text-gray-500">
              {["Mês", "Clientes", "Faturamento", "Taxa proc.", "Impostos", "Despesas", "Resultado", "Saldo"].map((h, i) => <th key={h} className={`px-2 py-1 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {c.meses.map((x) => (
              <tr key={x.m} className={`${x.m % 12 === 0 ? "border-b-2 border-gray-300" : ""} ${x.m % 2 ? "bg-gray-50" : ""} ${x.m === c.pay ? "outline outline-1 outline-green-600" : ""}`}>
                <td className="px-2 py-[3px] font-bold">{x.m}</td>
                <td className="px-2 py-[3px] text-right">{pct1(x.casos)}</td>
                <td className="px-2 py-[3px] text-right">{brl(x.faturamento)}</td>
                <td className="px-2 py-[3px] text-right">{brl(x.roy)}</td>
                <td className="px-2 py-[3px] text-right">{brl(x.imp)}</td>
                <td className="px-2 py-[3px] text-right">{brl(x.fixa)}</td>
                <td className="px-2 py-[3px] text-right font-bold" style={{ color: x.resultado < 0 ? RED : GREEN }}>{brl(x.resultado)}</td>
                <td className="px-2 py-[3px] text-right" style={x.saldo < 0 ? { color: RED } : undefined}>{brl(x.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[9px]" style={{ color: MUTED }}>Linha verde: mês em que o investimento é recuperado. Linhas mais grossas separam os anos.</p>
      </Page>
    </div>
  );
}
