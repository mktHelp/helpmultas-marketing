"use client";

// Peças compartilhadas da tela do DRE (antes duplicadas em ExpansionDre e DreVisual).

import { Tabs } from "@/components/ui/Tabs";
import { BRAND } from "@/lib/chart-theme";
import { brl, type DreInput, type DreResult } from "@/lib/expansion/dre";

export const NAVY = BRAND.blue;
export const YELLOW = BRAND.yellow;
export const GREEN = BRAND.green;
export const RED = BRAND.red;
export const ORANGE = BRAND.orange;

export type Filtro = "12 meses" | "24 meses" | "36 meses";
export const FILTROS: Filtro[] = ["12 meses", "24 meses", "36 meses"];
export const rowsOf = (c: DreResult, f: Filtro) => c.meses.slice(0, parseInt(f, 10));

export const f1 = (n: number) => n.toFixed(1).replace(".", ",");
export const pct = (n: number) => `${Math.round(n)}%`;
/** Valor contábil: negativo entre parênteses. */
export const brlC = (n: number) => (n < 0 ? `(${brl(-n)})` : brl(n));

export function PeriodTabs({ filtro, setFiltro }: { filtro: Filtro; setFiltro: (f: Filtro) => void }) {
  return (
    <div className="print:hidden">
      <Tabs tabs={FILTROS.map((f) => ({ key: f, label: f }))} active={filtro} onChange={(k) => setFiltro(k as Filtro)} />
    </div>
  );
}

/** Leads → clientes por canal. Cores neutras (cinza-azulado) com o marketing em amarelo. */
export function Funnel({ c, S }: { c: DreResult; S: DreInput }) {
  const rows = [
    { n: "Círculo", leads: c.leadsCirculo, conv: S.convCirculo, cli: c.casosCirculo, col: "#9db0bc" },
    { n: "Parceiros", leads: c.leadsParceiros, conv: S.convParceiros, cli: c.casosParceiros, col: "#6f93ab" },
    { n: "Marketing", leads: c.leadsMkt, conv: S.convMkt, cli: c.casosMkt, col: YELLOW },
  ];
  const mx = Math.max(1, ...rows.map((r) => r.leads));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.n}>
          <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{r.n}</span><span><b>{f1(r.leads)}</b> leads × {r.conv}% = <b>{f1(r.cli)}</b> clientes</span></div>
          <div className="h-3 rounded-full bg-black/5"><div className="h-full rounded-full" style={{ width: `${Math.max((r.leads / mx) * 100, 1.5)}%`, background: r.col }} /></div>
        </div>
      ))}
      <p className="pt-1 text-xs opacity-70">Por mês, no ritmo máximo: <b>{f1(c.leadsMes)}</b> leads viram <b>{f1(c.casosNovos)}</b> clientes novos, e a recompra soma <b>{f1(c.recompraMes)}</b>.</p>
    </div>
  );
}
