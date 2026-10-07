"use client";

// Telas de resultado do DRE (Resumo e DRE), desenhadas para serem mostradas ao lead
// durante a reunião: uma mensagem principal por tela, números grandes e gráficos que
// se explicam sozinhos. O que é só do consultor (análises, objeções) fica recolhido.

import { useState, type ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { CENARIOS, MODELO_LABEL, PERIODOS, brl, brlShort, calc, credPct, tot, type DreInput, type DreResult, type MesDre } from "@/lib/expansion/dre";
import { checagem, type Nivel } from "@/lib/expansion/insights";
import { DreDetalhada } from "./DreDetalhada";
import { Funnel, GREEN, NAVY, ORANGE, PeriodTabs, RED, YELLOW, brlC, f1, rowsOf, type Filtro } from "./parts";
import { CURSOR_STYLE, GRID_COLOR, TICK_STYLE, TOOLTIP_STYLE } from "@/lib/chart-theme";

const axisMoney = (v: number) => brlShort(v).replace("R$ ", "");

function Titulo({ children, sub, right }: { children: ReactNode; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="font-display text-[17px] font-semibold text-blue-900">{children}</h3>
        {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------------- topo: veredito ---------------- */

function PaybackTrack({ pay }: { pay: number | null }) {
  const pct = pay ? Math.min(pay / 36, 1) * 100 : 100;
  return (
    <div className="mt-7" aria-label={pay ? `Investimento recuperado no mês ${pay} de 36` : "Investimento não recuperado em 36 meses"}>
      <div className="relative h-3 rounded-full bg-white/15">
        <div className="h-full rounded-full bg-yellow-500 transition-[width] duration-700" style={{ width: `${pct}%`, opacity: pay ? 1 : 0.35 }} />
        {pay && <span className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-yellow-500 shadow-lg" style={{ left: `${pct}%` }} />}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-blue-200">
        <span>Início</span><span>12 meses</span><span>24 meses</span><span>36 meses</span>
      </div>
    </div>
  );
}

function Destaque({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm sm:p-5">
      <p className="text-xs font-semibold text-blue-100">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold xl:text-3xl", accent && "text-yellow-500")}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-blue-200">{sub}</p>}
    </div>
  );
}

function Hero({ S, c }: { S: DreInput; c: DreResult }) {
  const nome = S.lead.trim().split(" ")[0];
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-[#2c5a73] p-6 text-white sm:p-8 xl:p-10">
      <div className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
      <p className="relative text-xs font-bold uppercase tracking-widest text-yellow-500">
        Projeção de viabilidade · {S.modelo ? MODELO_LABEL[S.modelo] : "Franquia"}{S.regiao !== "Brasil" ? ` · ${S.regiao}` : ""}
      </p>
      <h2 className="relative mt-2 max-w-3xl font-display text-3xl font-bold leading-tight sm:text-4xl xl:text-5xl">
        {c.pay ? (
          <>{nome ? `${nome}, seu` : "Seu"} investimento volta no <span className="text-yellow-500">mês {c.pay}</span></>
        ) : (
          <>Com estas premissas, o retorno passa de <span className="text-yellow-500">36 meses</span></>
        )}
      </h2>
      <p className="relative mt-3 max-w-2xl text-sm text-blue-100 sm:text-base">
        {f1(c.casosMes)} clientes por mês a {brl(c.ticket)} de ticket médio{S.rampa > 1 ? `, chegando ao ritmo máximo em ${S.rampa} meses` : ""}.
      </p>
      <div className="relative"><PaybackTrack pay={c.pay} /></div>
      <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Destaque label="Investimento inicial" value={brl(c.inv)} sub="para abrir a operação" />
        <Destaque label="Faturamento líquido por mês" value={brl(c.pico.resultado)} sub={`a partir do mês ${Math.min(S.rampa, 36)}`} accent />
        <Destaque label="Lucro acumulado em 36 meses" value={brlShort(c.meses[35].acc)} sub="já descontado tudo" accent />
      </div>
    </div>
  );
}

function Faixa({ items }: { items: { label: string; value: string; sub: string }[] }) {
  return (
    <Card className="grid grid-cols-2 divide-gray-100 lg:grid-cols-4 lg:divide-x">
      {items.map((x) => (
        <div key={x.label} className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-gray-500">{x.label}</p>
          <p className="mt-0.5 font-display text-xl font-bold text-blue-900 sm:text-2xl">{x.value}</p>
          <p className="text-[11px] text-gray-500">{x.sub}</p>
        </div>
      ))}
    </Card>
  );
}

/* ---------------- gráficos ---------------- */

/** Saldo de caixa dos três cenários no mesmo gráfico: o lead enxerga a faixa de risco de uma vez. */
function Jornada({ S, c }: { S: DreInput; c: DreResult }) {
  const cen = CENARIOS.map((x) => ({ ...x, r: x.id === "realista" ? c : calc(S, x.ajuste) }));
  const [cons, real, otim] = cen;
  const data = Array.from({ length: 37 }, (_, m) => ({
    m,
    conservador: m ? cons.r.meses[m - 1].saldo : -c.inv,
    realista: m ? real.r.meses[m - 1].saldo : -c.inv,
    otimista: m ? otim.r.meses[m - 1].saldo : -c.inv,
  }));
  const cor = { conservador: ORANGE, realista: NAVY, otimista: GREEN };
  return (
    <Card className="p-5">
      <Titulo sub="Saldo do seu caixa, já descontado o investimento. Quando a linha cruza o zero, o investimento voltou.">Sua jornada financeira</Titulo>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cen.map((x) => (
          <div key={x.id} className={cn("rounded-2xl border p-4", x.id === "conservador" && "border-orange-400 bg-orange-50", x.id === "realista" && "border-yellow-500 bg-yellow-050", x.id === "otimista" && "border-[color:var(--color-success)] bg-[color:var(--color-success-bg)]")}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: cor[x.id] }} />
              <p className="font-display text-sm font-bold text-blue-900">{x.label}</p>
            </div>
            <p className="mb-3 mt-0.5 text-[11px] leading-snug text-gray-500">{x.id === "realista" ? "Premissas informadas" : x.id === "conservador" ? "40% menos clientes do círculo, marketing e parceiros" : "30% mais clientes do círculo, marketing e parceiros"}</p>
            <p className="text-xs text-gray-500">Retorno do investimento</p>
            <p className="font-display text-xl font-bold text-blue-900">{x.r.pay ? `Mês ${x.r.pay}` : "> 36 meses"}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-gray-500">Fat. líquido / mês</p>
                <p className={cn("font-display text-sm font-bold", x.r.pico.resultado < 0 ? "text-[color:var(--color-danger)]" : "text-blue-900")}>{brl(x.r.pico.resultado)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Clientes / mês</p>
                <p className="font-display text-sm font-bold text-blue-900">{f1(x.r.casosMes)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 12, top: 12 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="m" tick={TICK_STYLE} tickLine={false} interval={5} tickFormatter={(m) => (m === 0 ? "0" : `${m}`)} label={{ value: "meses", position: "insideBottomRight", offset: -2, fontSize: 11, fill: "#6b7f8c" }} />
            <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} width={60} tickFormatter={axisMoney} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(m) => `Mês ${m}`} formatter={(v) => brl(Number(v))} />
            <ReferenceLine y={0} stroke={NAVY} strokeWidth={1.5} label={{ value: "Investimento recuperado", position: "insideTopLeft", fontSize: 11, fill: NAVY }} />
            <Line type="monotone" dataKey="conservador" name="Conservador" stroke={cor.conservador} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="otimista" name="Otimista" stroke={cor.otimista} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="realista" name="Realista" stroke={cor.realista} strokeWidth={3.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Cascata: do faturamento até o que sobra no bolso. */
function Cascata({ r }: { r: MesDre[] }) {
  const fat = tot(r, "faturamento");
  const roy = tot(r, "roy");
  const imp = tot(r, "imp");
  const fixa = tot(r, "fixa");
  const res = tot(r, "resultado");
  const data = [
    { n: "Faturamento", v: fat, range: [0, fat], fill: NAVY },
    { n: "Taxa", v: -roy, range: [fat - roy, fat], fill: "#9db0bc" },
    { n: "Impostos", v: -imp, range: [fat - roy - imp, fat - roy], fill: "#6f93ab" },
    { n: "Despesas", v: -fixa, range: [Math.min(res, fat - roy - imp), Math.max(res, fat - roy - imp)], fill: "#4a6a80" },
    { n: "Fat. líquido", v: res, range: res >= 0 ? [0, res] : [res, 0], fill: res >= 0 ? YELLOW : RED },
  ];
  const centavos = fat > 0 ? Math.round((res / fat) * 100) : 0;
  return (
    <Card className="p-5">
      <Titulo sub="Do que entra até o que sobra no seu bolso" right={fat > 0 && res > 0 ? <span className="rounded-full bg-yellow-050 px-3 py-1 text-sm font-bold text-blue-900">R$ {centavos} de cada R$ 100 ficam com você</span> : undefined}>
        Para onde vai o dinheiro
      </Titulo>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 24 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="n" tick={TICK_STYLE} tickLine={false} interval={0} />
            <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} width={60} tickFormatter={axisMoney} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(_, __, p) => brl(Number((p.payload as { v: number }).v))} cursor={CURSOR_STYLE} />
            <ReferenceLine y={0} stroke="#cbd5dc" />
            <Bar dataKey="range" radius={[6, 6, 6, 6]} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.n} fill={d.fill} />)}
              <LabelList dataKey="v" position="top" fontSize={11} fontWeight={700} fill={NAVY} formatter={(v: unknown) => brlShort(Number(v))} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ResultadoMensal({ r, rampa }: { r: MesDre[]; rampa: number }) {
  return (
    <Card className="p-5">
      <Titulo sub="Quanto sobra em cada mês, depois de todos os custos">Faturamento líquido mês a mês</Titulo>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r} margin={{ left: 0, right: 8, top: 16 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="m" tick={TICK_STYLE} tickLine={false} interval={r.length > 12 ? 2 : 0} />
            <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} width={60} tickFormatter={axisMoney} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(m) => `Mês ${m}`} formatter={(v) => [brl(Number(v)), "Faturamento líquido"]} cursor={CURSOR_STYLE} />
            <ReferenceLine y={0} stroke="#cbd5dc" />
            {rampa <= r.length && rampa > 1 && <ReferenceLine x={rampa} stroke={NAVY} strokeDasharray="4 4" label={{ value: "ritmo máximo", position: "top", fontSize: 11, fill: NAVY }} />}
            <Bar dataKey="resultado" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {r.map((m) => <Cell key={m.m} fill={m.resultado >= 0 ? YELLOW : RED} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------------- análise do consultor (recolhida) ---------------- */

const NIVEL_ESTILO: Record<Nivel, { icon: typeof Info; cls: string }> = {
  alerta: { icon: AlertTriangle, cls: "text-[color:var(--color-danger)]" },
  atencao: { icon: Info, cls: "text-amber-600" },
  ok: { icon: CheckCircle2, cls: "text-[color:var(--color-success)]" },
};

export function ChecagemLista({ S, c, compacta }: { S: DreInput; c: DreResult; compacta?: boolean }) {
  const itens = checagem(S, c);
  return (
    <ul className="space-y-2.5">
      {itens.map((x) => {
        const { icon: Icon, cls } = NIVEL_ESTILO[x.nivel];
        return (
          <li key={x.titulo} className="flex gap-2.5">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cls)} />
            <div className="min-w-0">
              <p className={cn("text-sm font-bold", compacta ? "text-white" : "text-blue-900")}>{x.titulo}</p>
              <p className={cn("text-xs leading-snug", compacta ? "text-blue-100" : "text-gray-500")}>{x.texto}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Resumo ---------------- */

export function StepResumo({ S, c, filtro, setFiltro }: { S: DreInput; c: DreResult; filtro: Filtro; setFiltro: (f: Filtro) => void }) {
  const r = rowsOf(c, filtro);
  const fat = tot(r, "faturamento");
  const res = tot(r, "resultado");
  return (
    <div className="space-y-5">
      <Hero S={S} c={c} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-500">Detalhes do período</p>
        <PeriodTabs filtro={filtro} setFiltro={setFiltro} />
      </div>
      <Faixa
        items={[
          { label: `Faturamento em ${filtro}`, value: brlShort(fat), sub: "receita dos clientes" },
          { label: `Lucro em ${filtro}`, value: brlShort(res), sub: "já descontado tudo" },
          { label: "Margem líquida", value: `${fat ? f1((res / fat) * 100) : "0"}%`, sub: "fat. líquido ÷ faturamento" },
          { label: "Folga sobre o equilíbrio", value: c.folga !== null ? `${f1(c.folga)}×` : "—", sub: c.equilibrio !== null ? `equilíbrio: ${f1(c.equilibrio)} clientes/mês` : "sem margem por cliente" },
        ]}
      />

      <Jornada S={S} c={c} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Cascata r={r} />
        <ResultadoMensal r={r} rampa={S.rampa} />
      </div>

      <Card className="p-5">
        <Titulo sub={`${credPct(S)}% do círculo vira lead por ano; parceiros e marketing somam por cima`}>De onde vêm os clientes</Titulo>
        <Funnel c={c} S={S} />
      </Card>

    </div>
  );
}

/* ---------------- DRE ---------------- */

type ColDre = { n: number; fat: number; roy: number; imp: number; margem: number; fixa: number; res: number; saldo: number };

function DreTabela({ c }: { c: DreResult }) {
  const cols: ColDre[] = PERIODOS.map((n) => {
    const y = c.meses.slice(0, n);
    return { n, fat: tot(y, "faturamento"), roy: tot(y, "roy"), imp: tot(y, "imp"), margem: tot(y, "margem"), fixa: tot(y, "fixa"), res: tot(y, "resultado"), saldo: y[y.length - 1].saldo };
  });
  type Linha = { label: string; sub?: string; get: (x: ColDre) => number; kind: "top" | "ded" | "sub" | "final" | "muted"; semPct?: boolean };
  const linhas: Linha[] = [
    { label: "Receita bruta", sub: "o que os clientes pagam", get: (x) => x.fat, kind: "top" },
    { label: "Taxa de processamento", get: (x) => -x.roy, kind: "ded" },
    { label: "Impostos", get: (x) => -x.imp, kind: "ded" },
    { label: "Margem de contribuição", get: (x) => x.margem, kind: "sub" },
    { label: "Despesas fixas", get: (x) => -x.fixa, kind: "ded" },
    { label: "Faturamento líquido", sub: "o que sobra para você", get: (x) => x.res, kind: "final" },
    { label: "Faturamento líquido médio por mês", get: (x) => x.res / x.n, kind: "muted", semPct: true },
    { label: `Saldo após o investimento de ${brl(c.inv)}`, get: (x) => x.saldo, kind: "muted", semPct: true },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-3">
        <Titulo sub="Demonstração do Resultado do Exercício, acumulada. O % abaixo de cada valor é a fatia da receita.">DRE em 12, 24 e 36 meses</Titulo>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-blue-900">
          <thead>
            <tr className="border-y border-gray-200 bg-gray-050 text-xs font-bold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3 text-left">Descrição</th>
              {cols.map((x) => <th key={x.n} className="px-4 py-3 text-right">{x.n} meses</th>)}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.label} className={cn(l.kind === "sub" && "bg-blue-050", l.kind === "final" && "bg-blue-900 text-white", l.kind === "muted" && "text-gray-600", l.kind !== "final" && "border-b border-gray-100")}>
                <td className={cn("px-5 py-3.5", l.kind === "ded" && "pl-9 text-gray-600", (l.kind === "top" || l.kind === "sub" || l.kind === "final") && "font-bold")}>
                  <span className={cn(l.kind === "final" ? "text-base" : "text-sm")}>{l.kind === "ded" && <span className="mr-1.5 text-gray-400">(–)</span>}{l.label}</span>
                  {l.sub && <span className={cn("block text-[11px] font-normal", l.kind === "final" ? "text-blue-200" : "text-gray-500")}>{l.sub}</span>}
                </td>
                {cols.map((x) => {
                  const v = l.get(x);
                  return (
                    <td key={x.n} className="whitespace-nowrap px-4 py-3.5 text-right">
                      <span className={cn("block tabular-nums", l.kind === "final" ? "font-display text-xl font-bold text-yellow-500" : l.kind === "muted" ? "text-sm" : "text-sm font-semibold", v < 0 && l.kind !== "final" && l.kind !== "ded" && "text-[color:var(--color-danger)]", v < 0 && l.kind === "final" && "text-red-300")}>{brlC(v)}</span>
                      {!l.semPct && x.fat > 0 && <span className={cn("block text-[11px] tabular-nums", l.kind === "final" ? "text-blue-200" : "text-gray-400")}>{Math.round((Math.abs(v) / x.fat) * 100)}%</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SaldoCaixa({ c }: { c: DreResult }) {
  return (
    <Card className="p-5">
      <Titulo sub={`Depois do investimento inicial de ${brl(c.inv)}`}>Saldo de caixa acumulado</Titulo>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={c.meses} margin={{ left: 0, right: 12, top: 16 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="m" tick={TICK_STYLE} tickLine={false} interval={2} />
            <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} width={60} tickFormatter={axisMoney} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(m) => `Mês ${m}`} formatter={(v) => brl(Number(v))} />
            <ReferenceLine y={0} stroke={NAVY} />
            {c.pay && <ReferenceLine x={c.pay} stroke={GREEN} strokeDasharray="4 4" label={{ value: `Retorno: mês ${c.pay}`, fill: GREEN, fontSize: 11, position: "top" }} />}
            <Area type="monotone" dataKey="saldo" name="Saldo acumulado" stroke={NAVY} fill={NAVY} fillOpacity={0.14} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function FluxoMensal({ r, pay, full }: { r: MesDre[]; pay: number | null; full?: boolean }) {
  return (
    <div className={cn(!full && "max-h-[480px]", "overflow-auto rounded-xl border border-gray-100")}>
      <table className="w-full min-w-[720px] border-collapse text-sm text-blue-900">
        <thead className="sticky top-0 bg-white"><tr className="border-b border-gray-200 text-xs text-gray-500">{["Mês", "Clientes", "Faturamento", "Taxa proc.", "Impostos", "Despesas", "Fat. líquido", "Saldo"].map((h, i) => <th key={h} className={cn("px-3 py-2 font-semibold", i ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
        <tbody className="[&>tr:nth-child(even)]:bg-gray-050">
          {r.map((x) => (
            <tr key={x.m} className={cn(x.m === pay && "outline outline-1 -outline-offset-1 outline-[color:var(--color-success)]")}>
              <td className="px-3 py-1.5 font-bold">{x.m}</td>
              <td className="px-3 py-1.5 text-right">{f1(x.casos)}</td>
              <td className="px-3 py-1.5 text-right">{brl(x.faturamento)}</td>
              <td className="px-3 py-1.5 text-right">{brl(x.roy)}</td>
              <td className="px-3 py-1.5 text-right">{brl(x.imp)}</td>
              <td className="px-3 py-1.5 text-right">{brl(x.fixa)}</td>
              <td className={cn("px-3 py-1.5 text-right font-bold", x.resultado < 0 ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-success)]")}>{brl(x.resultado)}</td>
              <td className={cn("px-3 py-1.5 text-right", x.saldo < 0 && "text-[color:var(--color-danger)]")}>{brl(x.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepDre({ S, c, filtro, setFiltro, full }: { S: DreInput; c: DreResult; filtro: Filtro; setFiltro: (f: Filtro) => void; full?: boolean }) {
  const [mensal, setMensal] = useState(!!full);
  const r = rowsOf(c, filtro);
  return (
    <div className="space-y-5">
      <DreTabela c={c} />
      {S.modelo && <DreDetalhada S={S} c={c} meses={parseInt(filtro, 10)} tabs={<PeriodTabs filtro={filtro} setFiltro={setFiltro} />} />}
      <SaldoCaixa c={c} />
      <Card className="p-5">
        <Titulo
          sub="Todos os números mês a mês, para quem quiser conferir"
          right={
            <div className="flex items-center gap-2">
              {mensal && !full && <PeriodTabs filtro={filtro} setFiltro={setFiltro} />}
              {!full && (
                <button type="button" onClick={() => setMensal((m) => !m)} aria-expanded={mensal} className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-blue-900 px-3.5 text-xs font-bold text-blue-900 hover:bg-blue-050 print:hidden">
                  {mensal ? "Ocultar" : "Ver mês a mês"} <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", mensal && "rotate-180")} />
                </button>
              )}
            </div>
          }
        >
          Fluxo de caixa mensal
        </Titulo>
        {mensal && <FluxoMensal r={r} pay={c.pay} full={full} />}
      </Card>
    </div>
  );
}
