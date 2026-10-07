"use client";

import { Fragment } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { brl, type DreInput, type DreResult, type Item } from "@/lib/expansion/dre";
import { categoriaDe, type Categoria } from "@/lib/expansion/categoria";

// DRE em degraus (formato da planilha "DRE MODELO LOJA"): faturamento → margem de
// contribuição → margem ajustada pelo CAC → lucro operacional, mês a mês.
// Os números são os mesmos da DRE simples; aqui só ficam abertos por grupo de custo.

type Group = Categoria;

type Row =
  | { kind: "title"; label: string }
  | { kind: "item"; label: string; vals: number[] }
  | { kind: "sub"; label: string; vals: number[] }
  | { kind: "total"; label: string; vals: number[] };

export function DreDetalhada({ S, c, meses, tabs }: { S: DreInput; c: DreResult; meses: number; tabs: React.ReactNode }) {
  const ms = c.meses.slice(0, meses);
  const items = (g: Group): Item[] => S.desp.filter((d) => categoriaDe(d) === g);
  const cac = items("cac");
  const oper = items("oper");
  const pessoal = items("pessoal");
  const fixed = (it: Item) => ms.map(() => -(+it.v || 0));
  const sumRows = (...rows: number[][]) => ms.map((_, i) => rows.reduce((s, r) => s + r[i], 0));

  const fat = ms.map((m) => m.faturamento);
  const taxa = ms.map((m) => -m.roy);
  const imp = ms.map((m) => -m.imp);
  const margem = sumRows(fat, taxa, imp);
  const cacVals = cac.map(fixed);
  const operVals = oper.map(fixed);
  const pessoalVals = pessoal.map(fixed);
  const cacTot = cacVals.length ? sumRows(...cacVals) : ms.map(() => 0);
  const operTot = operVals.length ? sumRows(...operVals) : ms.map(() => 0);
  const pessoalTot = pessoalVals.length ? sumRows(...pessoalVals) : ms.map(() => 0);
  const margemAj = sumRows(margem, cacTot);
  const lucro = sumRows(margemAj, operTot, pessoalTot);
  const saldo = ms.map((m) => m.saldo);

  const rows: Row[] = [
    { kind: "total", label: "Faturamento bruto", vals: fat },
    { kind: "title", label: "Custo do serviço prestado" },
    { kind: "item", label: "Taxa de processamento", vals: taxa },
    { kind: "item", label: "Impostos", vals: imp },
    { kind: "sub", label: "Margem de contribuição", vals: margem },
    ...(cac.length ? [{ kind: "title" as const, label: "CAC · custo de aquisição do cliente" }] : []),
    ...cac.map((it, i) => ({ kind: "item" as const, label: it.n, vals: cacVals[i] })),
    { kind: "sub", label: "Margem de contribuição ajustada CAC", vals: margemAj },
    ...(oper.length ? [{ kind: "title" as const, label: "Despesas de operação" }] : []),
    ...oper.map((it, i) => ({ kind: "item" as const, label: it.n, vals: operVals[i] })),
    ...(pessoal.length ? [{ kind: "title" as const, label: "Pessoal" }] : []),
    ...pessoal.map((it, i) => ({ kind: "item" as const, label: it.n, vals: pessoalVals[i] })),
    { kind: "total", label: "Lucro operacional / líquido", vals: lucro },
    { kind: "sub", label: `Saldo de caixa acumulado (após investimento de ${brl(c.inv)})`, vals: saldo },
  ];

  const totalOf = (v: number[]) => v.reduce((s, x) => s + x, 0);
  const totalFat = totalOf(fat) || 1;
  const cell = "whitespace-nowrap px-2.5 py-1.5 text-right";
  // positivos em verde e negativos em vermelho; nas linhas de fundo escuro usa tons claros para manter a leitura
  const tone = (v: number, onDark: boolean) =>
    v > 0 ? (onDark ? "text-emerald-300" : "text-[color:var(--color-success)]") : v < 0 ? (onDark ? "text-red-300" : "text-[color:var(--color-danger)]") : "";

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-blue-900">DRE detalhada · Modelo {S.modelo === "loja" ? "Loja" : "Home Based"}</h3>
          <p className="text-xs text-gray-500">Em degraus, mês a mês, com o % sobre o faturamento do período</p>
        </div>
        {tabs}
      </div>
      <div className="max-h-[620px] overflow-auto rounded-xl border border-gray-100">
        <table className="w-max min-w-full border-collapse text-[12px] text-blue-900">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-gray-200 text-[11px] text-gray-500">
              <th className="sticky left-0 z-20 min-w-[250px] bg-white px-3 py-2 text-left font-semibold">Descrição</th>
              {ms.map((m) => <th key={m.m} className="px-2.5 py-2 text-right font-semibold">Mês {String(m.m).padStart(2, "0")}</th>)}
              <th className="bg-blue-050 px-2.5 py-2 text-right font-semibold text-blue-900">Total</th>
              <th className="bg-blue-050 px-2.5 py-2 text-right font-semibold text-blue-900">% fat.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              if (r.kind === "title") {
                return (
                  <tr key={i}>
                    <td colSpan={ms.length + 3} className="bg-gray-050 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">{r.label}</td>
                  </tr>
                );
              }
              const isSaldo = r.label.startsWith("Saldo");
              const tot = isSaldo ? r.vals[r.vals.length - 1] ?? 0 : totalOf(r.vals);
              const strong = r.kind === "total";
              const sub = r.kind === "sub";
              return (
                <tr key={i} className={cn(strong && "font-bold text-white", sub && "bg-gray-100 font-bold")} style={strong ? { background: "#243746" } : undefined}>
                  <td className={cn("sticky left-0 z-[1] px-3 py-1.5 text-left", strong ? "bg-blue-900" : sub ? "bg-gray-100" : "bg-white pl-6 text-gray-700")}>{r.label}</td>
                  {r.vals.map((v, k) => (
                    <td key={k} className={cn(cell, tone(v, strong))}>{brl(v)}</td>
                  ))}
                  <Fragment>
                    <td className={cn(cell, "font-bold", !strong && "bg-blue-050/60", tone(tot, strong))}>{brl(tot)}</td>
                    <td className={cn(cell, !strong && "bg-blue-050/60")}>{isSaldo ? "—" : `${((tot / totalFat) * 100).toFixed(1).replace(".", ",")}%`}</td>
                  </Fragment>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
