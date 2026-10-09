"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowLeftRight, ArrowRight, BarChart3, Check, ChevronDown, FolderOpen, Home, Loader2, MapPin, Settings2, Store, Plus, Save, Printer, Receipt, RotateCcw, Trash2, TrendingUp, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DreConflictError, getDreSimulation, saveDreSimulation } from "@/lib/services/dreSimulations";
import { SavedSimulations } from "./SavedSimulations";
import { DreReport } from "./DreReport";
import { StepDre, StepResumo } from "./DreVisual";
import { InsightsCard } from "./InsightsCard";
import { TrocarModelo } from "./TrocarModelo";
import { NovoLead } from "./NovoLead";
import { normalizar, pendentesDeIA } from "@/lib/expansion/categoria";
import { PreencherTexto } from "./PreencherTexto";
import { Funnel, type Filtro } from "./parts";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  CRED_PCT, DEFAULT_INPUT, MODELO_LABEL, inputForModelo, migrateInput, switchModelo, PRESETS, REGIOES, brl, brlShort, calc, credPct, num, sum,
  type Cred, type DreInput, type DreResult, type Item, type Modelo,
} from "@/lib/expansion/dre";

const STORAGE_KEY = "hm-expansion-dre-v5";
const UI_KEY = "hm-expansion-dre-ui-v2";
const STEPS = [
  { t: "Mercado", icon: Users, sub: "Quem o lead alcança, a credibilidade dele e quanto cada cliente deixa de receita." },
  { t: "Custos", icon: Wallet, sub: "O investimento para abrir a operação e os custos mensais." },
  { t: "Projeção", icon: TrendingUp, sub: "Dos leads aos clientes: quanto cada canal entrega por mês." },
  { t: "Resumo", icon: BarChart3, sub: "A visão geral da viabilidade, pronta para mostrar ao lead." },
  { t: "DRE", icon: Receipt, sub: "A demonstração do resultado em 12, 24 e 36 meses." },
] as const;
function load(): DreInput {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_INPUT);
    const saved = JSON.parse(raw) as Partial<DreInput>;
    // rascunho de antes dos modelos = Home Based (os padrões eram os dele)
    return migrateInput({ ...structuredClone(DEFAULT_INPUT), ...saved, modelo: saved.modelo === undefined ? "home" : saved.modelo });
  } catch {
    return structuredClone(DEFAULT_INPUT);
  }
}

export function ExpansionDre({ onModelo }: { onModelo?: (m: Modelo | null) => void } = {}) {
  const [S, setS] = useState<DreInput>(DEFAULT_INPUT);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>("36 meses");
  const [printing, setPrinting] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Simulação salva que esta pessoa abriu (para avisar se outra pessoa salvou por cima).
  const [loaded, setLoaded] = useState<{ id: string; updatedAt: string } | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [confirmModelo, setConfirmModelo] = useState(false);
  const [confirmNovo, setConfirmNovo] = useState(false);
  // alterações feitas depois do último salvar/abrir (protege o trabalho ao abrir outra simulação)
  const [dirty, setDirty] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<{ id: string; print: boolean } | null>(null);
  // A primeira tela é sempre a escolha do modelo; "started" vira true ao escolher, continuar ou abrir uma salva.
  const [started, setStarted] = useState(false);
  const { profile } = useAuth();
  const [saveState, setSaveState] = useState<{ kind: "idle" | "saving" | "ok" | "error"; msg?: string }>({ kind: "idle" });

  useEffect(() => {
    const saved = load();
    setS(saved);
    // Retoma exatamente de onde parou (etapa, período e simulação salva aberta) após recarregar a página.
    try {
      const raw = window.localStorage.getItem(UI_KEY);
      if (raw && saved.modelo) {
        const ui = JSON.parse(raw) as { started?: boolean; step?: number; filtro?: Filtro; loaded?: { id: string; updatedAt: string } | null; dirty?: boolean };
        if (ui.started) setStarted(true);
        if (typeof ui.step === "number" && ui.step >= 0 && ui.step < STEPS.length) setStep(ui.step);
        if (ui.filtro && ["12 meses", "24 meses", "36 meses"].includes(ui.filtro)) setFiltro(ui.filtro);
        if (ui.loaded?.id) setLoaded(ui.loaded);
        if (ui.dirty) setDirty(true);
      }
    } catch {
      // sem localStorage ou dado inválido: começa na tela inicial
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(UI_KEY, JSON.stringify({ started, step, filtro, loaded, dirty }));
    } catch {
      // sem localStorage: segue sem salvar
    }
  }, [started, step, filtro, loaded, dirty, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch {
      // sem localStorage: segue sem salvar
    }
  }, [S, ready]);

  const c = useMemo(() => calc(S), [S]);

  // Despesas com nome novo (que nenhuma regra reconhece) são classificadas pela IA em segundo plano.
  // Espera o nome parar de mudar, tenta cada nome uma vez por sessão e grava o resultado no item.
  const tentadas = useRef(new Set<string>());
  useEffect(() => {
    if (!ready || !started) return;
    const nomes = pendentesDeIA(S.desp).filter((n) => !tentadas.current.has(normalizar(n)));
    if (!nomes.length) return;
    const t = window.setTimeout(async () => {
      nomes.forEach((n) => tentadas.current.add(normalizar(n)));
      try {
        const r = await fetch("/api/expansao/categoria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nomes }) });
        if (!r.ok) return;
        const { categorias } = (await r.json()) as { categorias?: Record<string, "cac" | "oper" | "pessoal"> };
        if (!categorias || !Object.keys(categorias).length) return;
        setS((s) => ({ ...s, desp: s.desp.map((x) => (!x.cat && categorias[x.n.trim()] ? { ...x, cat: categorias[x.n.trim()] } : x)) }));
      } catch {
        // sem resposta da IA: o item fica em "operação"
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [S.desp, ready, started]);

  // Informa o modelo ao banner da página (só depois que a simulação começou).
  useEffect(() => {
    onModelo?.(ready && started ? S.modelo : null);
  }, [onModelo, ready, started, S.modelo]);

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
  const patch = (p: Partial<DreInput>) => {
    setDirty(true);
    setS((s) => ({ ...s, ...p }));
    setSaveState((st) => (st.kind === "idle" ? st : { kind: "idle" }));
  };
  const patchAll = (next: DreInput) => {
    setDirty(true);
    setS(next);
    setSaveState((st) => (st.kind === "idle" ? st : { kind: "idle" }));
  };
  const go = (n: number) => {
    if (n === step) return; // clicar na etapa em que já está não rola a página
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function abrirSalva(id: string, print = false) {
    setBusyId(id);
    try {
      const sim = await getDreSimulation(createClient(), id);
      setS(sim.input);
      setLoaded({ id: sim.id, updatedAt: sim.updatedAt });
      setDirty(false);
      setSaveState({ kind: "idle" });
      setSavedOpen(false);
      setStarted(true);
      setStep(0);
      setFiltro("36 meses");
      window.scrollTo({ top: 0 });
      if (print) window.setTimeout(imprimir, 150);
    } catch {
      setSaveState({ kind: "error", msg: "Não foi possível abrir a simulação. Tente de novo." });
      setSavedOpen(false);
    } finally {
      setBusyId(null);
    }
  }

  /** Devolve true só quando a simulação foi gravada. */
  /** Abrir uma salva substitui o que está na tela: confirma se há trabalho em andamento não salvo. */
  function pedirAbrirSalva(id: string, print = false) {
    const emAndamento = !!S.modelo && (!!S.lead.trim() || sum(S.mercado) > 0 || S.parceiros > 0 || S.leadsMkt !== DEFAULT_INPUT.leadsMkt);
    const protegido = !!loaded && !dirty; // a que está aberta já foi salva e não mudou
    if (emAndamento && !protegido) {
      setSavedOpen(false);
      setPendingOpen({ id, print });
      return;
    }
    void abrirSalva(id, print);
  }

  async function salvar(force = false): Promise<boolean> {
    if (!S.lead.trim()) {
      setSaveState({ kind: "error", msg: "Informe o nome do lead (etapa Mercado) para salvar." });
      return false;
    }
    setSaveState({ kind: "saving" });
    try {
      const r = await saveDreSimulation(createClient(), S, c, profile?.id ?? null, { expectedId: loaded?.id, expectedUpdatedAt: loaded?.updatedAt, force });
      setLoaded({ id: r.id, updatedAt: r.updatedAt });
      setDirty(false);
      setSaveState({ kind: "ok", msg: r.kind === "created" ? `Simulação de ${S.lead.trim()} salva.` : `Simulação de ${S.lead.trim()} atualizada.` });
      return true;
    } catch (e) {
      if (e instanceof DreConflictError) {
        setSaveState({ kind: "idle" });
        setConfirmNovo(false);
        setConfirmOverwrite(true);
        return false;
      }
      setSaveState({ kind: "error", msg: e instanceof Error && e.message ? e.message : "Não foi possível salvar. Tente de novo." });
      return false;
    }
  }

  async function salvarENovo() {
    if (await salvar()) {
      setConfirmNovo(false);
      irParaInicio();
    }
  }

  /** Volta à tela inicial para começar outro lead; o rascunho atual continua lá em "Continuar". */
  function irParaInicio() {
    setStarted(false);
    setStep(0);
    window.scrollTo({ top: 0 });
  }

  function pickRegiao(r: string) {
    patch({ regiao: r });
  }

  if (printing) return <DreReport S={S} c={c} />;

  function escolherModelo(m: Modelo) {
    setStarted(true);
    setS(inputForModelo(m));
    setLoaded(null);
    setStep(0);
    setSaveState({ kind: "idle" });
  }
  function trocarModelo() {
    if (!S.modelo) return;
    setConfirmModelo(false);
    patchAll(switchModelo(S, S.modelo === "home" ? "loja" : "home"));
  }
  const outroModelo: Modelo = S.modelo === "loja" ? "home" : "loja";

  if (!ready) return null;

  if (!started || !S.modelo) {
    const draftLead = S.lead.trim();
    const hasDraft = !!S.modelo && (!!draftLead || sum(S.mercado) > 0 || S.parceiros > 0 || S.leadsMkt !== DEFAULT_INPUT.leadsMkt);
    return (
      <>
        <ModeloPicker onPick={escolherModelo} onSaved={() => setSavedOpen(true)} draft={hasDraft ? { lead: draftLead } : null} onContinue={() => setStarted(true)} />
        <SavedSimulations open={savedOpen} onClose={() => setSavedOpen(false)} onOpen={(id) => pedirAbrirSalva(id)} onPrint={(id) => pedirAbrirSalva(id, true)} busyId={busyId} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho: etapa atual, ações da simulação e progresso */}
      <header className="space-y-4 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">
              Etapa {step + 1} de {STEPS.length} · {MODELO_LABEL[S.modelo]}{S.lead ? ` · ${S.lead}` : ""}
            </p>
            <h2 className="mt-0.5 font-display text-2xl font-bold text-blue-900 sm:text-3xl">{STEPS[step].t}</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-500">{STEPS[step].sub}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setConfirmNovo(true)} className="flex h-10 items-center gap-2 rounded-full bg-yellow-500 px-4 text-sm font-bold text-blue-900 shadow-[var(--shadow-sm)] transition-colors hover:bg-yellow-600">
              <Plus className="h-4 w-4" /> <span className="max-sm:hidden">Nova simulação</span>
            </button>
            <MenuSimulacao outroModelo={MODELO_LABEL[outroModelo]} onTrocarModelo={() => setConfirmModelo(true)} onSalvas={() => setSavedOpen(true)} />
          </div>
        </div>

        <nav aria-label="Etapas da simulação">
          <ol className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {STEPS.map(({ t, icon: Icon }, i) => (
              <li key={t}>
                <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined} className="group block w-full text-left">
                  <span className={cn("block h-1.5 rounded-full transition-colors", i <= step ? "bg-yellow-500" : "bg-gray-200 group-hover:bg-gray-300")} />
                  <span className={cn("mt-2 hidden items-center gap-1.5 text-xs font-bold sm:flex md:hidden lg:flex", i === step ? "text-blue-900" : i < step ? "text-blue-800" : "text-gray-400 group-hover:text-gray-500")}>
                    {i < step ? <Check className="h-3.5 w-3.5 text-[color:var(--color-success)]" /> : <Icon className="h-3.5 w-3.5" />}
                    <span className="truncate">{t}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      {step === 0 && <StepMercado S={S} c={c} patch={patch} pickRegiao={pickRegiao} />}
      {step === 1 && <StepCustos S={S} c={c} patch={patch} />}
      {step === 2 && <StepProjecao S={S} c={c} patch={patch} />}
      {step === 3 && <StepResumo S={S} c={c} filtro={filtro} setFiltro={setFiltro} />}
      {step === 4 && <StepDre S={S} c={c} filtro={filtro} setFiltro={setFiltro} />}

      <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl bg-white/90 p-2.5 shadow-[var(--shadow-lg)] ring-1 ring-gray-200 backdrop-blur print:hidden">
        <Button variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {saveState.msg && (
            <span className={cn("hidden truncate text-xs font-semibold md:block", saveState.kind === "error" ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-success)]")}>{saveState.msg}</span>
          )}
          <Button variant="secondary" onClick={() => salvar()} disabled={saveState.kind === "saving"}>
            {saveState.kind === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </Button>
          {step >= 3 && (
            <Button variant="secondary" onClick={imprimir}>
              <Printer className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
            </Button>
          )}
          {step < STEPS.length - 1 && (
            <Button onClick={() => go(step + 1)}>
              Avançar <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {saveState.msg && (
        <p className={cn("px-1 text-center text-xs font-semibold md:hidden print:hidden", saveState.kind === "error" ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-success)]")}>{saveState.msg}</p>
      )}
      <SavedSimulations open={savedOpen} onClose={() => setSavedOpen(false)} onOpen={(id) => pedirAbrirSalva(id)} onPrint={(id) => pedirAbrirSalva(id, true)} busyId={busyId} />
      <ConfirmDialog
        open={!!pendingOpen}
        onClose={() => setPendingOpen(null)}
        onConfirm={() => {
          const p = pendingOpen;
          setPendingOpen(null);
          if (p) void abrirSalva(p.id, p.print);
        }}
        title="Abrir a simulação salva?"
        description={`Você tem uma simulação em andamento${S.lead.trim() ? ` (${S.lead.trim()})` : ""} com alterações que ainda não foram salvas. Abrir a salva substitui o que está na tela. Cancele e use Salvar antes se quiser guardar o que você fez.`}
        confirmLabel="Sim, abrir a salva"
        danger
      />
      <TrocarModelo open={confirmModelo} atual={S.modelo} onClose={() => setConfirmModelo(false)} onConfirm={trocarModelo} />
      <NovoLead
        open={confirmNovo}
        onClose={() => setConfirmNovo(false)}
        S={S}
        c={c}
        jaSalva={saveState.kind === "ok"}
        salvando={saveState.kind === "saving"}
        erro={saveState.kind === "error" ? saveState.msg : undefined}
        onSalvarENovo={salvarENovo}
        onNovo={() => {
          setConfirmNovo(false);
          irParaInicio();
        }}
      />
      <ConfirmDialog
        open={confirmOverwrite}
        onClose={() => setConfirmOverwrite(false)}
        onConfirm={() => {
          setConfirmOverwrite(false);
          salvar(true);
        }}
        title="Sobrescrever a simulação?"
        description="Outra pessoa salvou esta simulação depois que você a abriu. Se continuar, o que ela salvou será substituído pelo que está na sua tela."
        confirmLabel="Sobrescrever"
        danger
      />
    </div>
  );
}

function MenuSimulacao({ outroModelo, onTrocarModelo, onSalvas }: { outroModelo: string; onTrocarModelo: () => void; onSalvas: () => void }) {
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
  const itens = [
    { icon: FolderOpen, label: "Simulações salvas", sub: "Abrir, comparar ou gerar PDF", tile: "bg-blue-050 text-blue-900", on: onSalvas },
    { icon: ArrowLeftRight, label: `Trocar para ${outroModelo}`, sub: "Compare os modelos; o que você preencheu é mantido", tile: "bg-blue-050 text-blue-900", on: onTrocarModelo },
  ];
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-blue-900 shadow-[var(--shadow-sm)] ring-1 transition-colors", open ? "ring-blue-900" : "ring-gray-200 hover:ring-blue-900")}
      >
        <Settings2 className="h-4 w-4" /> Opções <ChevronDown className={cn("h-4 w-4 text-gray-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[var(--shadow-lg)]">
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Esta simulação</p>
          {itens.map(({ icon: Icon, label, sub, tile, on }) => (
            <button key={label} type="button" role="menuitem" onClick={() => { setOpen(false); on(); }} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-gray-050">
              <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tile)}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-blue-900">{label}</span>
                <span className="block text-xs leading-snug text-gray-500">{sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModeloPicker({ onPick, onSaved, draft, onContinue }: { onPick: (m: Modelo) => void; onSaved: () => void; draft: { lead: string } | null; onContinue: () => void }) {
  const cards = [
    { m: "home" as const, title: "Home Based", desc: "Operação enxuta, a partir de casa ou de uma sala própria.", icon: Home, tags: ["Sem ponto físico", "Custo fixo baixo"], card: "bg-gradient-to-br from-blue-900 via-blue-800 to-[#2c5a73] text-white", chip: "bg-yellow-500 text-blue-900", sub: "text-blue-100", tag: "bg-white/10 text-blue-100", cta: "bg-yellow-500 text-blue-900" },
    { m: "loja" as const, title: "Loja", desc: "Operação com ponto físico e estrutura própria.", icon: Store, tags: ["Ponto físico", "DRE detalhada"], card: "bg-white text-blue-900 ring-1 ring-gray-200", chip: "bg-blue-900 text-yellow-500", sub: "text-gray-500", tag: "bg-blue-050 text-blue-800", cta: "bg-blue-900 text-white" },
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4 sm:py-10">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">Simulador de viabilidade</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-blue-900 sm:text-4xl lg:text-5xl">Qual modelo vamos simular?</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-gray-500">Cada modelo já vem com valores pré-definidos. Tudo pode ser ajustado durante a reunião.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {cards.map(({ m, title, desc, icon: Icon, tags, card, chip, sub, tag, cta }) => {
          const p = PRESETS[m];
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPick(m)}
              className={cn("group relative flex min-h-[300px] flex-col items-start overflow-hidden rounded-3xl p-7 text-left shadow-[var(--shadow-md)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]", card)}
            >
              <span className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
              <span className={cn("relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg", chip)}><Icon className="h-7 w-7" /></span>
              <span className="relative mt-6 block font-display text-3xl font-bold">{title}</span>
              <span className={cn("relative mt-1 block text-sm", sub)}>{desc}</span>
              <span className="relative mb-6 mt-4 flex flex-wrap gap-1.5">
                {tags.map((t) => <span key={t} className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tag)}>{t}</span>)}
              </span>
              <span className="relative mt-auto grid w-full grid-cols-2 gap-3 border-t border-current/10 pt-5">
                <span><span className={cn("block text-[11px] font-semibold", sub)}>Adesão</span><b className="font-display text-lg">{brl(p.invest[0].v)}</b></span>
                <span><span className={cn("block text-[11px] font-semibold", sub)}>Taxa de processamento</span><b className="font-display text-lg">{p.royalties}%</b></span>
              </span>
              <span className={cn("relative mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform group-hover:translate-x-0.5", cta)}>
                Começar simulação <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row">
        {draft && (
          <button type="button" onClick={onContinue} className="flex flex-1 items-center gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-[var(--shadow-sm)] ring-1 ring-gray-200 transition-all hover:ring-blue-900">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-050 text-yellow-600"><RotateCcw className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-blue-900">Continuar{draft.lead ? ` a simulação de ${draft.lead}` : " de onde parou"}</span>
              <span className="block text-xs text-gray-500">Retoma o rascunho deste navegador. Escolher um modelo acima começa um lead novo e o substitui.</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-blue-900" />
          </button>
        )}
        <button type="button" onClick={onSaved} className="flex flex-1 items-center gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-[var(--shadow-sm)] ring-1 ring-gray-200 transition-all hover:ring-blue-900">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-050 text-blue-900"><FolderOpen className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-blue-900">Simulações salvas</span>
            <span className="block text-xs text-gray-500">Abrir, comparar ou gerar o PDF de um lead</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-blue-900" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- peças de UI ---------------- */

type StepProps = { S: DreInput; c: DreResult; patch: (p: Partial<DreInput>) => void };

function Split({ children, aside, insights }: { children: ReactNode; aside: ReactNode; insights?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">{children}</div>
      <div className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-0.5 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">{aside}{insights}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5">
        <h3 className="font-display text-lg font-bold text-blue-900">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-gray-500">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-blue-900 outline-none transition-colors placeholder:text-gray-300 hover:border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30";

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
  // renomear apaga a categoria gravada para o nome antigo; a IA classifica de novo o nome novo
  const set = (i: number, p: Partial<Item>) => onChange(items.map((x, k) => (k === i ? { ...x, ...p, ...(p.n !== undefined ? { cat: undefined } : {}) } : x)));
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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-[#2c5a73] p-5 text-white shadow-[var(--shadow-md)] sm:p-6">
      <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
      <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-100">
        <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" /> Sua DRE ao vivo
      </p>
      <div className="relative mt-3">
        <p className="text-xs text-blue-100">Retorno do investimento</p>
        <p className="font-display text-4xl font-bold text-yellow-500">{c.pay ? `Mês ${c.pay}` : "> 36 meses"}</p>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-3">
        <Stat label="Faturamento líquido / mês" value={brlShort(p.resultado)} accent />
        <Stat label="Faturamento / mês" value={brlShort(p.faturamento)} />
        <Stat label="Clientes / mês" value={c.casosMes.toFixed(1).replace(".", ",")} />
        <Stat label="Ticket médio" value={brl(c.ticket)} />
      </div>
      {children && <div className="relative mt-5 border-t border-white/15 pt-5">{children}</div>}
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

/* ---------------- etapas ---------------- */

function StepMercado({ S, c, patch, pickRegiao }: StepProps & { pickRegiao: (r: string) => void }) {
  return (
    <Split
      insights={<><InsightsCard step={0} S={S} c={c} /><InsightsCard step={1} S={S} c={c} /></>}
      aside={
        <Live c={c}>
          <p className="mb-3 text-sm font-semibold">Composição do mercado</p>
          <Bars items={S.mercado.map((x) => ({ n: x.n, v: +x.v || 0, fmt: num }))} />
          <p className="mt-3 text-xs text-blue-100">{num(c.mercado)} pessoas alcançadas</p>
        </Live>
      }
    >
      <PreencherTexto S={S} onApply={patch} />
      <Section title="Quem é o lead?">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome do lead">
            <input value={S.lead} onChange={(e) => patch({ lead: e.target.value })} placeholder="Ex.: Roberson Alvarenga" className={inputCls} />
          </Field>
          <Field label="Região">
            <RegionSelect value={S.regiao} options={["Brasil", ...REGIOES]} onChange={pickRegiao} />
          </Field>
          <div className="sm:col-span-2">
          <Field label="Ticket médio" help="Receita média por cliente fechado.">
            <NumInput value={S.ticket} onChange={(ticket) => patch({ ticket })} prefix="R$" />
          </Field>
          </div>
        </div>
      </Section>
      <ItemList title="Quem você alcança" items={S.mercado} onChange={(mercado) => patch({ mercado })} total="Total de pessoas alcançadas" />
      <Section title="Parceiros" hint="indicações recorrentes">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Quantos parceiros você consegue fazer na sua região?" help="Contadores, despachantes, autoescolas, oficinas, etc.">
            <NumInput value={S.parceiros} onChange={(parceiros) => patch({ parceiros })} />
          </Field>
          <Field label="Indicações por parceiro, por mês" help="Média de leads que cada parceiro indica por mês.">
            <NumInput value={S.indicPorParceiro} onChange={(indicPorParceiro) => patch({ indicPorParceiro })} />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-blue-050 px-4 py-3 text-sm">
          <span className="font-semibold text-blue-800">Leads por mês via parceiros</span>
          <b className="font-display text-base text-blue-900">{c.leadsParceiros.toFixed(1).replace(".", ",")}</b>
        </div>
      </Section>
      <Section title="Sua credibilidade no seu meio" hint="% do círculo que vira lead em 12 meses">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"]] as [Exclude<Cred, "livre">, string][]).map(([v, t]) => (
            <button key={v} type="button" onClick={() => patch({ cred: v })} className={cn("rounded-xl border-2 py-2 text-sm font-bold transition-colors", S.cred === v ? "border-blue-900 bg-blue-900 text-white" : "border-gray-200 text-blue-900 hover:border-blue-900")}>
              {t}
              <span className={cn("block text-xs font-semibold", S.cred === v ? "text-yellow-500" : "text-gray-500")}>{CRED_PCT[v]}%</span>
            </button>
          ))}
          <button type="button" onClick={() => patch({ cred: "livre" })} className={cn("rounded-xl border-2 py-2 text-sm font-bold transition-colors", S.cred === "livre" ? "border-blue-900 bg-blue-900 text-white" : "border-gray-200 text-blue-900 hover:border-blue-900")}>
            Livre
            <span className={cn("block text-xs font-semibold", S.cred === "livre" ? "text-yellow-500" : "text-gray-500")}>{S.credLivre}%</span>
          </button>
        </div>
        {S.cred === "livre" && (
          <Field label="Porcentagem personalizada">
            <NumInput value={S.credLivre} onChange={(credLivre) => patch({ credLivre })} suffix="%" className="mt-2 max-w-[180px]" />
          </Field>
        )}
        <p className="mt-3 text-xs text-gray-500">
          {num(c.mercado)} pessoas × {credPct(S)}% = {num((c.mercado * credPct(S)) / 100)} leads em 12 meses, ou <b>{c.leadsCirculo.toFixed(1).replace(".", ",")} por mês</b>.
        </p>
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
                {sel && <Check className="h-4 w-4 shrink-0 text-yellow-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepCustos({ S, c, patch }: StepProps) {
  return (
    <Split
      insights={<><InsightsCard step={2} S={S} c={c} /><InsightsCard step={3} S={S} c={c} /></>}
      aside={
        <Live c={c}>
          <p className="mb-3 text-sm font-semibold">Para onde vai o investimento</p>
          <Bars items={S.invest.map((x) => ({ n: x.n, v: +x.v || 0 }))} />
          <p className="mb-3 mt-5 text-sm font-semibold">Despesas fixas por mês</p>
          <Bars items={S.desp.map((x) => ({ n: x.n, v: +x.v || 0 }))} />
          {c.equilibrio !== null && (
            <p className="mt-3 text-xs text-blue-100">Para pagar tudo, você precisa de <b className="text-yellow-500">{c.equilibrio.toFixed(1).replace(".", ",")} clientes/mês</b>.</p>
          )}
        </Live>
      }
    >
      <ItemList title="Investimento inicial" items={S.invest} onChange={(invest) => patch({ invest })} total="Total a investir" unit="R$" />
      <ItemList title="Despesas fixas por mês" items={S.desp} onChange={(desp) => patch({ desp })} total="Despesa fixa mensal" unit="R$" />
      <Section title="Custos sobre o faturamento" hint="variáveis">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taxa de Processamento (média)"><NumInput value={S.royalties} onChange={(royalties) => patch({ royalties })} suffix="%" /></Field>
          <Field label="Impostos"><NumInput value={S.imposto} onChange={(imposto) => patch({ imposto })} suffix="%" /></Field>
        </div>
      </Section>
    </Split>
  );
}

const ROW = "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)] items-center gap-3";

function StepProjecao({ S, c, patch }: StepProps) {
  const f = (n: number) => n.toFixed(1).replace(".", ",");
  const canais = [
    { n: "Círculo", desc: `${num(c.mercado)} pessoas × ${credPct(S)}% ÷ 12 meses`, leads: c.leadsCirculo, key: "convCirculo" as const, cli: c.casosCirculo },
    { n: "Parceiros", desc: `${S.parceiros} parceiros × ${f(S.indicPorParceiro)} indicações/mês`, leads: c.leadsParceiros, key: "convParceiros" as const, cli: c.casosParceiros },
    { n: "Marketing", desc: "leads gerados por mês pelo marketing", leads: c.leadsMkt, key: "convMkt" as const, cli: c.casosMkt },
  ];
  return (
    <Split insights={<InsightsCard step={4} S={S} c={c} />} aside={<Live c={c}><p className="mb-3 text-sm font-semibold">Dos leads aos clientes</p><div className="text-white"><FunnelDark c={c} S={S} /></div></Live>}>
      <Section title="Leads e clientes por mês" hint="no ritmo máximo">
        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            <div className={cn(ROW, "pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500")}>
              <span>Canal</span><span>Leads</span><span>Conversão</span><span className="text-right">Clientes</span>
            </div>
            {canais.map((x) => (
              <div key={x.n} className={cn(ROW, "border-t border-gray-100 py-2.5")}>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-blue-900">{x.n}</p>
                  <p className="truncate text-[11px] text-gray-500" title={x.desc}>{x.desc}</p>
                </div>
                {x.n === "Marketing" ? (
                  <NumInput value={S.leadsMkt} onChange={(leadsMkt) => patch({ leadsMkt })} className="[&_input]:h-9" />
                ) : (
                  <p className="font-display text-base font-bold text-blue-900">{f(x.leads)}</p>
                )}
                <NumInput value={S[x.key]} onChange={(v) => patch({ [x.key]: v } as Partial<DreInput>)} suffix="%" className="[&_input]:h-9" />
                <p className="text-right font-display text-base font-bold text-blue-900">{f(x.cli)}</p>
              </div>
            ))}
            <div className={cn(ROW, "rounded-xl bg-blue-050 px-3 py-2.5 text-blue-900")}>
              <span className="font-display text-sm font-bold">Total</span>
              <b className="font-display text-base">{f(c.leadsMes)}</b>
              <span className="text-[11px] text-blue-800">× ticket {brl(c.ticket)}</span>
              <span className="text-right"><b className="font-display text-base">{f(c.casosMes)}</b><span className="block text-[11px] text-blue-800">{brl(c.casosMes * c.ticket)}/mês</span></span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <span className="text-sm font-semibold text-blue-900">Meses até atingir o ritmo máximo</span>
          <NumInput value={S.rampa} onChange={(rampa) => patch({ rampa })} suffix="meses" className="w-36 shrink-0 [&_input]:h-9" />
        </div>
      </Section>
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-400 px-5 py-4 text-blue-900">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-900 font-display text-sm font-bold text-yellow-500">60d</span>
        <div>
          <p className="font-display text-sm font-bold">Após 60 dias - recompra e indicação</p>
          <p className="text-sm">20% a 30% volta a comprar e indica novos clientes</p>
        </div>
      </div>
    </Split>
  );
}

function FunnelDark({ c, S }: { c: DreResult; S: DreInput }) {
  return <div className="rounded-xl bg-white p-4 text-blue-900"><Funnel c={c} S={S} /></div>;
}
