"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowLeft, ArrowRight, BarChart3, Check, ChevronDown, MapPin, Plus, Printer, Receipt, RotateCcw, Trash2, TrendingUp, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DreReport } from "./DreReport";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  CENARIOS, CRED, DEFAULT_INPUT, DRE_DATA, REGIOES, brl, brlShort, calc, mktOf, num, perfilOf, sum, ticketOf, tot,
  type Cred, type DreInput, type DreResult, type Item,
} from "@/lib/expansion/dre";

const STORAGE_KEY = "hm-expansion-dre-v1";
const STEPS = [
  { t: "Mercado", icon: Users },
  { t: "Ticket médio", icon: Receipt },
  { t: "Investimento", icon: Wallet },
  { t: "Despesas", icon: Receipt },
  { t: "Projeção", icon: TrendingUp },
  { t: "Resumo", icon: BarChart3 },
  { t: "DRE", icon: Receipt },
] as const;
const NAVY = "#243746";
const YELLOW = "#fcbf00";
const GREEN = "#2f8f5b";

type Filtro = "Todos" | "Ano 1" | "Ano 2" | "Ano 3";

function load(): DreInput {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...structuredClone(DEFAULT_INPUT), ...JSON.parse(raw) } : structuredClone(DEFAULT_INPUT);
  } catch {
    return structuredClone(DEFAULT_INPUT);
  }
}

export function ExpansionDre() {
  const [S, setS] = useState<DreInput>(DEFAULT_INPUT);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [confirmNovo, setConfirmNovo] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setS(load());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch {
      // sem localStorage: segue sem salvar
    }
  }, [S, ready]);

  const c = useMemo(() => calc(S), [S]);

  // Relatório impresso: monta Resumo + DRE completos (sem rolagem interna) e só então abre o diálogo.
  useEffect(() => {
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);
  function imprimir() {
    setPrinting(true);
    window.setTimeout(() => window.print(), 700);
  }
  const patch = (p: Partial<DreInput>) => setS((s) => ({ ...s, ...p }));
  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function novoLead() {
    setConfirmNovo(false);
    setS(structuredClone(DEFAULT_INPUT));
    setStep(0);
  }

  function pickRegiao(r: string) {
    patch({ regiao: r, ticket: ticketOf(r), ...perfilOf(r) });
  }

  if (printing) return <DreReport S={S} c={c} />;

  return (
    <div className="space-y-4">
      {/* Etapas */}
      <Card className="p-2 print:hidden">
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STEPS.map(({ t, icon: Icon }, i) => (
            <button
              key={t}
              type="button"
              ref={i === step ? (el) => el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }) : undefined}
              onClick={() => go(i)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors sm:text-sm",
                i === step ? "bg-blue-900 text-white" : i < step ? "text-blue-800 hover:bg-blue-050" : "text-gray-500 hover:bg-gray-050"
              )}
            >
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px]", i === step ? "bg-yellow-500 text-blue-900" : "bg-gray-100")}>
                {i + 1}
              </span>
              <Icon className="hidden h-4 w-4 sm:block" />
              {t}
            </button>
          ))}
          <button type="button" onClick={() => setConfirmNovo(true)} className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-050 hover:text-blue-900">
            <RotateCcw className="h-3.5 w-3.5" /> Novo lead
          </button>
        </div>
      </Card>

      {S.lead && step !== 5 && (
        <p className="px-1 text-sm text-gray-500">
          Simulação para <b className="text-blue-900">{S.lead}</b>
        </p>
      )}

      {step === 0 && <StepMercado S={S} c={c} patch={patch} />}
      {step === 1 && <StepTicket S={S} c={c} patch={patch} pickRegiao={pickRegiao} />}
      {step === 2 && <StepInvest S={S} c={c} patch={patch} />}
      {step === 3 && <StepDespesas S={S} c={c} patch={patch} />}
      {step === 4 && <StepProjecao S={S} c={c} patch={patch} />}
      {step === 5 && <StepResumo S={S} c={c} filtro={filtro} setFiltro={setFiltro} />}
      {step === 6 && <StepDre S={S} c={c} filtro={filtro} setFiltro={setFiltro} />}

      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button variant="dark" disabled={step === 0} onClick={() => go(step - 1)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          {step >= 5 && (
            <Button variant="secondary" onClick={imprimir}>
              <Printer className="h-4 w-4" /> Imprimir / salvar PDF
            </Button>
          )}
          {step < STEPS.length - 1 && (
            <Button onClick={() => go(step + 1)}>
              Avançar <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmNovo}
        onClose={() => setConfirmNovo(false)}
        onConfirm={novoLead}
        title="Iniciar novo lead?"
        description="Os dados da simulação atual serão apagados e você volta para a primeira etapa."
        confirmLabel="Sim, novo lead"
      />
    </div>
  );
}

/* ---------------- peças de UI ---------------- */

type StepProps = { S: DreInput; c: DreResult; patch: (p: Partial<DreInput>) => void };

function Split({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">{children}</div>
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">{aside}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-blue-900">{title}</h3>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      {children}
    </Card>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-blue-900 outline-none transition-colors focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30";

function NumInput({ value, onChange, prefix, suffix, className }: { value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={cn(inputCls, prefix && "pl-9", suffix && "pr-14")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{suffix}</span>}
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-blue-900">{label}</span>
      {children}
      {help && <span className="mt-1.5 block text-xs leading-snug text-gray-500">{help}</span>}
    </label>
  );
}

function ItemList({ title, items, onChange, total, unit = "" }: { title: string; items: Item[]; onChange: (i: Item[]) => void; total: string; unit?: string }) {
  const set = (i: number, p: Partial<Item>) => onChange(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <Section title={title} hint={`${items.length} itens`}>
      <div className="space-y-2">
        {items.map((x, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={x.n} onChange={(e) => set(i, { n: e.target.value })} className={cn(inputCls, "flex-1")} aria-label="Descrição" />
            <NumInput value={x.v} onChange={(v) => set(i, { v })} prefix={unit} className="w-32 shrink-0" />
            <button type="button" aria-label="Remover" onClick={() => onChange(items.filter((_, k) => k !== i))} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[color:var(--color-danger)]">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, { n: "Novo item", v: 0 }])} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-blue-800 hover:text-blue-900">
        <Plus className="h-4 w-4" /> Adicionar item
      </button>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-blue-050 px-4 py-3 text-sm">
        <span className="font-semibold text-blue-800">{total}</span>
        <b className="font-display text-base text-blue-900">{unit ? unit + " " : ""}{num(sum(items))}</b>
      </div>
    </Section>
  );
}

function Live({ c, children }: { c: DreResult; children?: ReactNode }) {
  const p = c.pico;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-5 text-white shadow-[var(--shadow-md)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" /> Sua DRE ao vivo
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Retorno" value={c.pay ? `Mês ${c.pay}` : "> 36 meses"} accent />
        <Stat label="Casos / mês" value={c.casosMes.toFixed(1).replace(".", ",")} />
        <Stat label="Faturamento / mês" value={brlShort(p.faturamento)} />
        <Stat label="Resultado / mês" value={brlShort(p.resultado)} accent />
      </div>
      {children && <div className="mt-4 border-t border-white/15 pt-4">{children}</div>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <small className="block text-[11px] text-blue-100">{label}</small>
      <b className={cn("font-display text-lg", accent && "text-yellow-500")}>{value}</b>
    </div>
  );
}

function Bars({ items }: { items: { n: string; v: number; fmt?: (n: number) => string }[] }) {
  const mx = Math.max(1, ...items.map((x) => x.v));
  return (
    <div className="space-y-3">
      {items.map((x, i) => (
        <div key={i}>
          <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate text-blue-100">{x.n}</span><b>{(x.fmt ?? brl)(x.v)}</b></div>
          <div className="h-2 rounded-full bg-white/15"><div className="h-full rounded-full bg-yellow-500" style={{ width: `${(x.v / mx) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function Funnel({ c, mkt }: { c: DreResult; mkt: number }) {
  const rows = [
    ["Pessoas no círculo", c.mercado, "#9db0bc"],
    ["Dirigem (têm CNH)", c.dirigem, "#9db0bc"],
    ["Recebem multa por ano", c.comMulta, "#6f93ab"],
    ["Contratam o recurso", c.fecham, YELLOW],
  ] as const;
  const mx = Math.max(1, c.mercado);
  return (
    <div className="space-y-3">
      {rows.map(([n, v, col]) => (
        <div key={n}>
          <div className="mb-1 flex justify-between text-xs"><span>{n}</span><span><b>{num(v)}</b> <span className="opacity-60">{((v / mx) * 100).toFixed(v / mx < 0.1 ? 1 : 0).replace(".", ",")}%</span></span></div>
          <div className="h-3 rounded-full bg-black/5"><div className="h-full rounded-full" style={{ width: `${Math.max((v / mx) * 100, 1.5)}%`, background: col }} /></div>
        </div>
      ))}
      <p className="pt-1 text-xs opacity-70">Além do círculo, o marketing digital soma <b>{mkt}</b> casos por mês.</p>
    </div>
  );
}

/* ---------------- etapas ---------------- */

function StepMercado({ S, c, patch }: StepProps) {
  return (
    <Split
      aside={
        <Live c={c}>
          <p className="mb-3 text-sm font-semibold">Composição do mercado</p>
          <Bars items={S.mercado.map((x) => ({ n: x.n, v: +x.v || 0, fmt: num }))} />
          <p className="mt-3 text-xs text-blue-100">{num(c.mercado)} pessoas alcançadas</p>
        </Live>
      }
    >
      <Section title="Quem é o lead?">
        <Field label="Nome do lead">
          <input value={S.lead} onChange={(e) => patch({ lead: e.target.value })} placeholder="Ex.: Roberson Alvarenga" className={inputCls} />
        </Field>
      </Section>
      <ItemList title="Quem ele alcança" items={S.mercado} onChange={(mercado) => patch({ mercado })} total="Total de pessoas alcançadas" />
      <Section title="Credibilidade no meio dele" hint="quanto o círculo confia nele">
        <div className="grid grid-cols-3 gap-2">
          {([["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"]] as [Cred, string][]).map(([v, t]) => (
            <button key={v} type="button" onClick={() => patch({ cred: v })} className={cn("rounded-xl border-2 py-2.5 text-sm font-bold transition-colors", S.cred === v ? "border-blue-900 bg-blue-900 text-white" : "border-gray-200 text-blue-900 hover:border-blue-900")}>
              {t}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">Peso aplicado ao círculo: {Math.round(CRED[S.cred] * 100)}%.</p>
      </Section>
    </Split>
  );
}

function RegionSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (r: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-12 w-full items-center gap-3 rounded-2xl border bg-white px-3.5 text-left text-sm font-semibold text-blue-900 transition-shadow",
          open ? "border-yellow-500 ring-2 ring-yellow-500/30" : "border-gray-200 hover:border-blue-900"
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow-500 text-blue-900"><MapPin className="h-4 w-4" /></span>
        <span className="flex-1 truncate">{value}</span>
        <span className="text-xs font-semibold text-gray-500">{brl(ticketOf(value))}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-gray-500", open && "rotate-180")} />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[var(--shadow-lg)]">
          {options.map((r) => {
            const sel = r === value;
            return (
              <button
                key={r}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                }}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors", sel ? "bg-yellow-050 font-bold text-blue-900" : "text-blue-900 hover:bg-gray-050")}
              >
                <MapPin className={cn("h-4 w-4 shrink-0", sel ? "text-yellow-600" : "text-gray-400")} />
                <span className="flex-1">{r}</span>
                <span className="text-xs text-gray-500">{brl(ticketOf(r))}</span>
                {sel && <Check className="h-4 w-4 shrink-0 text-yellow-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepTicket({ S, c, patch, pickRegiao }: StepProps & { pickRegiao: (r: string) => void }) {
  const ref = ticketOf(S.regiao);
  const regioes = ["Brasil", ...REGIOES];
  return (
    <Split
      aside={
        <Live c={c}>
          <p className="text-sm font-semibold">Ticket médio</p>
          <p className="mb-4 font-display text-3xl font-bold text-yellow-500">{brl(c.ticket)}</p>
          <p className="mb-3 text-sm font-semibold">Por região</p>
          <Bars items={regioes.map((r) => ({ n: r, v: ticketOf(r) }))} />
          <p className="mt-3 text-xs text-blue-100">
            Com {c.casosMes.toFixed(1).replace(".", ",")} casos/mês: <b className="text-yellow-500">{brl(c.casosMes * c.ticket)}</b> por mês no ritmo máximo.
          </p>
        </Live>
      }
    >
      <Section title="Região do lead" hint="Brasil = ticket geral">
        <RegionSelect value={S.regiao} options={regioes} onChange={pickRegiao} />
      </Section>
      <Section title="Ticket médio" hint="honorário médio por caso">
        <Field label="Ticket médio" help={`${DRE_DATA.fonteTicket}. Região escolhida: ${brl(ref)}.`}>
          <NumInput value={S.ticket} onChange={(ticket) => patch({ ticket })} prefix="R$" />
        </Field>
        {+S.ticket !== ref && (
          <button type="button" onClick={() => patch({ ticket: ref })} className="mt-3 text-sm font-semibold text-blue-800 hover:text-blue-900">
            Restaurar ticket da base ({brl(ref)})
          </button>
        )}
      </Section>
    </Split>
  );
}

function StepInvest({ S, c, patch }: StepProps) {
  return (
    <Split
      aside={
        <Live c={c}>
          <p className="mb-3 text-sm font-semibold">Para onde vai o investimento</p>
          <Bars items={S.invest.map((x) => ({ n: x.n, v: +x.v || 0 }))} />
          <p className="mt-3 text-xs text-blue-100">Retorno estimado: <b className="text-yellow-500">{c.pay ? `mês ${c.pay}` : "acima de 36 meses"}</b></p>
        </Live>
      }
    >
      <ItemList title="Investimento inicial" items={S.invest} onChange={(invest) => patch({ invest })} total="Total a investir" unit="R$" />
    </Split>
  );
}

function StepDespesas({ S, c, patch }: StepProps) {
  return (
    <Split
      aside={
        <Live c={c}>
          <p className="mb-3 text-sm font-semibold">Despesas fixas por mês</p>
          <Bars items={S.desp.map((x) => ({ n: x.n, v: +x.v || 0 }))} />
          {c.equilibrio !== null && (
            <p className="mt-3 text-xs text-blue-100">Para pagar tudo, ele precisa de <b className="text-yellow-500">{c.equilibrio.toFixed(1).replace(".", ",")} casos/mês</b>.</p>
          )}
        </Live>
      }
    >
      <ItemList title="Despesas fixas por mês" items={S.desp} onChange={(desp) => patch({ desp })} total="Despesa fixa mensal" unit="R$" />
      <Section title="Custos sobre o faturamento" hint="variáveis">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Royalties à rede"><NumInput value={S.royalties} onChange={(royalties) => patch({ royalties })} suffix="%" /></Field>
          <Field label="Impostos"><NumInput value={S.imposto} onChange={(imposto) => patch({ imposto })} suffix="%" /></Field>
        </div>
      </Section>
    </Split>
  );
}

function StepProjecao({ S, c, patch }: StepProps) {
  const pf = perfilOf(S.regiao);
  const mk = mktOf(S.regiao);
  const mod = S.dirige !== pf.dirige || S.multa !== pf.multa || S.mkt !== pf.mkt;
  const idx = (DRE_DATA.perfil[S.regiao] ?? DRE_DATA.perfil.Brasil).indice;
  return (
    <Split aside={<Live c={c}><p className="mb-3 text-sm font-semibold">Funil do círculo</p><div className="text-white [&_.opacity-60]:text-blue-100"><FunnelDark c={c} mkt={S.mkt} /></div></Live>}>
      <Section title="Volume do círculo" hint={S.regiao === "Brasil" ? "média nacional" : S.regiao}>
        <div className="space-y-4">
          <Field label="Dos contatos, quantos % dirigem (têm CNH)" help={`Habilitados ÷ população: ${pf.dirige}% em ${S.regiao}.`}>
            <NumInput value={S.dirige} onChange={(dirige) => patch({ dirige })} suffix="%" />
          </Field>
          <Field label="Dos motoristas, quantos % recebem multa por ano" help={`Base nacional ${DRE_DATA.baseMulta}% ajustada pelo índice de infrações de ${S.regiao} (×${idx.toFixed(2).replace(".", ",")}).`}>
            <NumInput value={S.multa} onChange={(multa) => patch({ multa })} suffix="%" />
          </Field>
          <Field label="Dos que recebem multa, quantos % contratam o recurso" help="Premissa do lead; teste valores menores para ver o cenário conservador.">
            <NumInput value={S.conv} onChange={(conv) => patch({ conv })} suffix="%" />
          </Field>
        </div>
        {mod && (
          <button type="button" onClick={() => patch(perfilOf(S.regiao))} className="mt-3 text-sm font-semibold text-blue-800 hover:text-blue-900">
            Restaurar dados de {S.regiao}
          </button>
        )}
        <p className="mt-3 text-xs text-gray-500">Fonte: {DRE_DATA.perfilFonte}. A região vem da etapa Ticket médio.</p>
      </Section>
      <Section title="Crescimento" hint="marketing e ritmo">
        <div className="space-y-4">
          <Field label="Casos por mês via marketing digital e indicações" help={`Média da rede em ${S.regiao}: ${num(mk.vendas)} vendas ÷ ${mk.un} unidades ÷ ${mk.meses.toFixed(1).replace(".", ",")} meses (este ano).`}>
            <NumInput value={S.mkt} onChange={(mkt) => patch({ mkt })} />
          </Field>
          <Field label="Meses até atingir o ritmo máximo">
            <NumInput value={S.rampa} onChange={(rampa) => patch({ rampa })} suffix="meses" />
          </Field>
        </div>
      </Section>
    </Split>
  );
}

function FunnelDark({ c, mkt }: { c: DreResult; mkt: number }) {
  return <div className="rounded-xl bg-white p-4 text-blue-900"><Funnel c={c} mkt={mkt} /></div>;
}

/* ---------------- resumo + DRE ---------------- */

function Tabs({ filtro, setFiltro }: { filtro: Filtro; setFiltro: (f: Filtro) => void }) {
  return (
    <div className="inline-flex rounded-full bg-gray-100 p-1 print:hidden">
      {(["Todos", "Ano 1", "Ano 2", "Ano 3"] as Filtro[]).map((t) => (
        <button key={t} type="button" onClick={() => setFiltro(t)} className={cn("rounded-full px-3.5 py-1 text-xs font-bold transition-colors", filtro === t ? "bg-blue-900 text-white" : "text-gray-500 hover:text-blue-900")}>
          {t}
        </button>
      ))}
    </div>
  );
}

const rowsOf = (c: DreResult, f: Filtro) => (f === "Todos" ? c.meses : c.meses.filter((x) => x.ano === Number(f.slice(-1))));
const tooltipStyle = { borderRadius: 12, border: "1px solid #e6ecf0", fontSize: 12 };

function StepResumo({ S, c, filtro, setFiltro }: { S: DreInput; c: DreResult; filtro: Filtro; setFiltro: (f: Filtro) => void }) {
  const r = rowsOf(c, filtro);
  const fat = tot(r, "faturamento");
  const res = tot(r, "resultado");
  const margemPct = fat ? ((res / fat) * 100).toFixed(1).replace(".", ",") : "0";
  const anual = [1, 2, 3].map((a) => {
    const rs = c.meses.filter((x) => x.ano === a);
    return { ano: `Ano ${a}`, Faturamento: Math.round(tot(rs, "faturamento")), Resultado: Math.round(tot(rs, "resultado")) };
  });
  const cenarios = CENARIOS.map((cn_) => ({ ...cn_, r: calc(S, cn_.ajuste) }));

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-[#2c5a73] p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wider text-yellow-500">Resumo executivo</p>
        <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
          {c.pay ? (
            <>{S.lead ? `${S.lead}, seu` : "Seu"} investimento volta no <span className="text-yellow-500">mês {c.pay}</span></>
          ) : (
            "O retorno passa de 36 meses com estas premissas"
          )}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-blue-100">
          Com base em um círculo de {num(c.mercado)} pessoas, projetamos <b className="text-white">{c.casosMes.toFixed(1).replace(".", ",")} casos por mês</b> e um resultado líquido de{" "}
          <b className="text-white">{brl(c.pico.resultado)}/mês</b>{S.regiao !== "Brasil" ? ` em ${S.regiao}` : ""}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {[["Investimento", brl(c.inv)], ["Ticket médio", brl(c.ticket)], ["Credibilidade", S.cred]].map(([k, v]) => (
            <span key={k} className="rounded-full bg-white/10 px-3 py-1.5 text-blue-100">{k} <b className="text-white">{v}</b></span>
          ))}
        </div>
      </div>

      <Tabs filtro={filtro} setFiltro={setFiltro} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Mercado primário" value={num(c.mercado)} sub="pessoas no círculo" />
        <Kpi label="Motoristas com multa/ano" value={num(c.comMulta)} sub="oportunidades no círculo" />
        <Kpi label={`Faturamento (${filtro})`} value={brlShort(fat)} sub="honorários dos recursos" />
        <Kpi label="Investimento inicial" value={brl(c.inv)} sub="para abrir a operação" />
        <Kpi label="Retorno do investimento" value={c.pay ? `Mês ${c.pay}` : "> 36 meses"} sub="saldo acumulado positivo" tone="navy" />
        <Kpi label={`Margem líquida (${filtro})`} value={`${margemPct}%`} sub="resultado ÷ faturamento" tone="yellow" />
        <Kpi label={`Lucro acumulado (${filtro})`} value={brlShort(res)} sub="já descontado tudo" tone="yellow" />
        <Kpi label="Retorno em 36 meses" value={c.roi36 !== null ? `${c.roi36.toFixed(1).replace(".", ",")}×` : "—"} sub="lucro ÷ investimento" tone="navy" />
      </div>

      {/* Prova de viabilidade */}
      <Card className="p-5">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-blue-900">E se der menos certo do que o esperado?</h3>
          <span className="text-xs text-gray-500">mesma operação, três cenários</span>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {c.equilibrio !== null && c.folga !== null ? (
            <>Ponto de equilíbrio: <b className="text-blue-900">{c.equilibrio.toFixed(1).replace(".", ",")} casos/mês</b> para pagar as despesas fixas. A projeção realista tem <b className="text-blue-900">{c.folga.toFixed(1).replace(".", ",")}×</b> essa folga.</>
          ) : (
            "Sem margem positiva por caso com os custos informados."
          )}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cenarios.map((x) => (
            <div key={x.id} className={cn("rounded-2xl border p-4", x.id === "realista" ? "border-yellow-500 bg-yellow-050" : "border-gray-200")}>
              <p className="font-display text-sm font-bold text-blue-900">{x.label}</p>
              <p className="mb-3 text-[11px] leading-snug text-gray-500">{x.desc}</p>
              <p className="text-xs text-gray-500">Retorno</p>
              <p className="font-display text-xl font-bold text-blue-900">{x.r.pay ? `Mês ${x.r.pay}` : "> 36 meses"}</p>
              <p className="mt-2 text-xs text-gray-500">Resultado / mês</p>
              <p className={cn("font-display text-base font-bold", x.r.pico.resultado < 0 ? "text-[color:var(--color-danger)]" : "text-blue-900")}>{brl(x.r.pico.resultado)}</p>
              <p className="mt-2 text-xs text-gray-500">Casos / mês</p>
              <p className="text-sm font-bold text-blue-900">{x.r.casosMes.toFixed(1).replace(".", ",")}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-baseline justify-between"><h3 className="font-display text-base font-semibold text-blue-900">Margem e resultado mensal</h3><span className="text-xs text-gray-500">passe o mouse sobre o gráfico</span></div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={r} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke="#e6ecf0" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => brlShort(v).replace("R$ ", "")} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(m) => `Mês ${m}`} formatter={(v) => brl(Number(v))} />
              <Legend />
              <Area type="monotone" dataKey="margem" name="Margem (após royalties e impostos)" stroke={YELLOW} fill={YELLOW} fillOpacity={0.18} strokeWidth={2.5} />
              <Area type="monotone" dataKey="resultado" name="Resultado líquido" stroke={NAVY} fill={NAVY} fillOpacity={0.05} strokeWidth={2.5} />
              {c.pay && filtro === "Todos" && <ReferenceLine x={c.pay} stroke={GREEN} strokeDasharray="4 4" label={{ value: `Retorno: mês ${c.pay}`, fill: GREEN, fontSize: 11, position: "top" }} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-display text-base font-semibold text-blue-900">Para onde vai cada R$ 100 <span className="text-xs font-normal text-gray-500">({filtro})</span></h3>
          <Split100 fat={fat} roy={tot(r, "roy")} imp={tot(r, "imp")} fx={tot(r, "fixa")} res={res} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-display text-base font-semibold text-blue-900">Evolução por ano</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={anual} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke="#e6ecf0" vertical={false} />
                <XAxis dataKey="ano" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => brlShort(v).replace("R$ ", "")} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => brl(Number(v))} />
                <Legend />
                <Bar dataKey="Faturamento" fill={NAVY} radius={[8, 8, 0, 0]} />
                <Bar dataKey="Resultado" fill={YELLOW} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-display text-base font-semibold text-blue-900">Do círculo ao cliente</h3>
        <Funnel c={c} mkt={S.mkt} />
      </Card>
    </div>
  );
}

function Split100({ fat, roy, imp, fx, res }: { fat: number; roy: number; imp: number; fx: number; res: number }) {
  const items = [
    { n: "Royalties à rede", v: roy, color: "#9db0bc" },
    { n: "Impostos", v: imp, color: "#4a6a80" },
    { n: "Despesas fixas", v: fx, color: NAVY },
    { n: "Resultado líquido", v: Math.max(res, 0), color: YELLOW },
  ];
  const T = items.reduce((s, x) => s + x.v, 0) || 1;
  return (
    <div>
      <div className="mb-4 flex h-5 overflow-hidden rounded-full bg-gray-100">
        {items.map((x) => <div key={x.n} style={{ width: `${(x.v / T) * 100}%`, background: x.color }} title={x.n} />)}
      </div>
      <div className="space-y-2.5">
        {items.map((x) => (
          <div key={x.n} className="flex items-center gap-2 text-sm">
            <i className="h-3 w-3 shrink-0 rounded-sm" style={{ background: x.color }} />
            <span className="flex-1 text-blue-900">{x.n}</span>
            <b className="text-blue-900">{Math.round((x.v / T) * 100)}%</b>
            <span className="w-24 text-right text-xs text-gray-500">{brlShort(x.v)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-xl bg-yellow-050 px-3 py-2 text-sm text-blue-900">
        {fat > 0 ? <>De cada R$ 100 faturados, <b>R$ {Math.round((res / fat) * 100)}</b> ficam com o franqueado.</> : "Sem faturamento no período."}
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "navy" | "yellow" }) {
  return (
    <div className={cn("rounded-2xl border p-4", tone === "navy" ? "border-blue-900 bg-blue-900 text-white" : tone === "yellow" ? "border-yellow-500 bg-yellow-500 text-blue-900" : "border-gray-200 bg-white text-blue-900")}>
      <small className={cn("block text-[11px] font-semibold", tone === "navy" ? "text-blue-100" : "opacity-70")}>{label}</small>
      <div className="font-display text-xl font-bold sm:text-2xl">{value}</div>
      <div className={cn("text-[11px]", tone === "navy" ? "text-blue-100" : "opacity-70")}>{sub}</div>
    </div>
  );
}

function StepDre({ c, filtro, setFiltro, full }: { S: DreInput; c: DreResult; filtro: Filtro; setFiltro: (f: Filtro) => void; full?: boolean }) {
  const ys = [1, 2, 3].map((a) => c.meses.filter((x) => x.ano === a));
  const r = rowsOf(c, filtro);
  const line = (label: string, k: "faturamento" | "roy" | "imp" | "margem" | "fixa" | "resultado", kind: "t" | "r" | "n" = "n", neg = false) => (
    <tr className={cn(kind === "t" && "bg-gray-050 font-bold", kind === "r" && "bg-blue-900 font-bold text-white")}>
      <td className={cn("px-3 py-2", kind === "n" && "pl-6 text-gray-700")}>{label}</td>
      {[...ys, c.meses].map((y, i) => {
        const v = tot(y, k);
        return <td key={i} className={cn("whitespace-nowrap px-3 py-2 text-right", v < 0 && kind !== "r" && "text-[color:var(--color-danger)]")}>{brl(neg ? -v : v)}</td>;
      })}
    </tr>
  );
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex items-baseline justify-between"><h3 className="font-display text-base font-semibold text-blue-900">DRE anual</h3><span className="text-xs text-gray-500">Demonstração do Resultado do Exercício</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm text-blue-900">
            <thead><tr className="border-b border-gray-200 text-xs text-gray-500">{["Descrição", "Ano 1", "Ano 2", "Ano 3", "Total 36 meses"].map((h, i) => <th key={h} className={cn("px-3 py-2 font-semibold", i ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
            <tbody>
              {line("Faturamento (honorários dos recursos)", "faturamento", "t")}
              {line("(-) Royalties / repasse à rede", "roy", "n", true)}
              {line("(-) Impostos", "imp", "n", true)}
              {line("= Margem de contribuição", "margem", "t")}
              {line("(-) Despesas fixas", "fixa", "n", true)}
              {line("= Resultado líquido", "resultado", "r")}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-baseline justify-between"><h3 className="font-display text-base font-semibold text-blue-900">Saldo de caixa acumulado</h3><span className="text-xs text-gray-500">após o investimento inicial de {brl(c.inv)}</span></div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={c.meses} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke="#e6ecf0" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => brlShort(v).replace("R$ ", "")} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(m) => `Mês ${m}`} formatter={(v) => brl(Number(v))} />
              <ReferenceLine y={0} stroke={NAVY} />
              {c.pay && <ReferenceLine x={c.pay} stroke={GREEN} strokeDasharray="4 4" label={{ value: `Retorno: mês ${c.pay}`, fill: GREEN, fontSize: 11, position: "top" }} />}
              <Area type="monotone" dataKey="saldo" name="Saldo acumulado" stroke={NAVY} fill={NAVY} fillOpacity={0.14} strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className={cn("p-5", full && "print:break-inside-auto")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-base font-semibold text-blue-900">Fluxo de caixa mensal</h3>{!full && <Tabs filtro={filtro} setFiltro={setFiltro} />}</div>
        <div className={cn(!full && "max-h-[480px] overflow-auto")}>
          <table className="w-full min-w-[720px] border-collapse text-sm text-blue-900">
            <thead className={cn(!full && "sticky top-0 bg-white")}><tr className="border-b border-gray-200 text-xs text-gray-500">{["Mês", "Casos", "Faturamento", "Royalties", "Impostos", "Despesas", "Resultado", "Saldo"].map((h, i) => <th key={h} className={cn("px-3 py-2 font-semibold", i ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
            <tbody className="[&>tr:nth-child(even)]:bg-gray-050">
              {r.map((x) => (
                <tr key={x.m}>
                  <td className="px-3 py-1.5 font-bold">{x.m}</td>
                  <td className="px-3 py-1.5 text-right">{x.casos.toFixed(1).replace(".", ",")}</td>
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
      </Card>
    </div>
  );
}
