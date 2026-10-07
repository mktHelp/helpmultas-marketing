// Simulador de DRE do franqueado (área da Expansão): cálculo puro, sem dependência
// de React. Os valores padrão abaixo são fixos (base: simulação real já aprovada) e
// todos podem ser alterados na tela para cada lead; nada vem de fontes externas.

export const REGIOES = ["Sul", "Sudeste", "Centro-Oeste", "Nordeste", "Norte"] as const;
export type Regiao = "Brasil" | (typeof REGIOES)[number];

/** % do círculo que vira lead por ano, conforme a credibilidade do lead no meio dele. */
export const CRED_PCT = { alta: 20, media: 10, baixa: 5 } as const;
export type Cred = keyof typeof CRED_PCT | "livre";

export const PERIODOS = [12, 24, 36] as const;
export type Periodo = (typeof PERIODOS)[number];

export interface Item {
  n: string;
  v: number;
  /** categoria na DRE detalhada, gravada pela IA quando o nome não é reconhecido por regra (ver categoria.ts) */
  cat?: "cac" | "oper" | "pessoal";
}

export interface DreInput {
  lead: string;
  mercado: Item[];
  cred: Cred;
  /** % usado quando cred === "livre" */
  credLivre: number;
  regiao: string;
  ticket: number;
  invest: Item[];
  desp: Item[];
  /** Taxa de processamento (média), % sobre o faturamento */
  royalties: number;
  imposto: number;
  /** parceiros que o lead consegue fazer na região e leads que cada um indica por mês */
  parceiros: number;
  indicPorParceiro: number;
  /** leads por mês vindos do marketing */
  leadsMkt: number;
  /** taxa de conversão (lead -> cliente) de cada canal, em % */
  convCirculo: number;
  convParceiros: number;
  convMkt: number;
  rampa: number;
  /** % dos clientes que, após 60 dias, voltam a comprar e indicam novos clientes (entra no cálculo) */
  recompra: number;
  /** modelo de operação escolhido antes de simular; null = ainda não escolheu */
  modelo: Modelo | null;
}

export type Modelo = "home" | "loja";
export const MODELO_LABEL: Record<Modelo, string> = { home: "Home Based", loja: "Loja" };

export const credPct = (S: Pick<DreInput, "cred" | "credLivre">) => (S.cred === "livre" ? Math.max(+S.credLivre || 0, 0) : CRED_PCT[S.cred] ?? CRED_PCT.media);

export const DEFAULT_INPUT: DreInput = {
  lead: "",
  // O círculo é de cada lead: começa zerado para ser preenchido.
  mercado: [
    { n: "Família (tios, primos, parentes)", v: 0 },
    { n: "Amigos próximos", v: 0 },
    { n: "Pessoas com quem você trabalhou", v: 0 },
    { n: "Contatos de WhatsApp", v: 0 },
    { n: "Amigos do Facebook", v: 0 },
    { n: "Amigos do Instagram", v: 0 },
  ],
  cred: "media",
  credLivre: 10,
  regiao: "Brasil",
  ticket: 1000,
  invest: [
    { n: "Taxa de adesão à rede", v: 29900 },
    { n: "Estrutura (home office / sala)", v: 0 },
    { n: "Equipamentos (Computador, Celular)", v: 0 },
    { n: "Capital de giro", v: 0 },
  ],
  desp: [
    { n: "Internet e telefone", v: 0 },
    { n: "Sistemas / CRM", v: 595 },
    { n: "Gestor de Tráfego", v: 0 },
    { n: "Tráfego Pago", v: 0 },
    { n: "Marketing Nacional", v: 231 },
    { n: "Contador", v: 0 },
    { n: "Pró-labore / retirada", v: 0 },
  ],
  royalties: 50,
  imposto: 3,
  parceiros: 0,
  indicPorParceiro: 1.5,
  // pré-definido em 200 leads/mês do marketing (o consultor pode alterar)
  leadsMkt: 200,
  convCirculo: 50,
  convParceiros: 50,
  convMkt: 10,
  rampa: 6,
  recompra: 25,
  modelo: null,
};

// ---------- Modelos de operação ----------
// Os valores pré-definidos de cada modelo. Home Based = os padrões acima.
const PRESET_KEYS = [
  "ticket", "invest", "desp", "royalties", "imposto", "indicPorParceiro", "leadsMkt",
  "convCirculo", "convParceiros", "convMkt", "rampa", "recompra", "cred", "credLivre",
] as const;
type PresetKey = (typeof PRESET_KEYS)[number];
export type ModeloPreset = Pick<DreInput, PresetKey>;

const pickPreset = (src: DreInput): ModeloPreset => structuredClone(Object.fromEntries(PRESET_KEYS.map((k) => [k, src[k]])) as ModeloPreset);

export const PRESETS: Record<Modelo, ModeloPreset> = {
  home: pickPreset(DEFAULT_INPUT),
  // Modelo Loja: parte do Home Based e muda só o que já foi definido (investimento de R$ 139.900: adesão de
  // R$ 59.900, sala de R$ 60.000 e capital de giro de R$ 20.000; despesas de ponto físico e taxa de processamento de 33%). Impostos e demais premissas
  // seguem iguais ao Home Based até serem definidas.
  loja: lojaPreset(),
};

function lojaPreset(): ModeloPreset {
  const p = pickPreset(DEFAULT_INPUT);
  p.invest = [
    { n: "Taxa de adesão à rede", v: 59900 },
    { n: "Estrutura (sala, computador, celular e equipamentos em geral)", v: 60000 },
    { n: "Capital de giro", v: 20000 },
  ];
  p.desp = [
    { n: "Internet e telefone", v: 0 },
    { n: "Água", v: 0 },
    { n: "Aluguel", v: 0 },
    { n: "Energia", v: 0 },
    { n: "Sistemas / CRM", v: 595 },
    { n: "Gestor de Tráfego", v: 0 },
    { n: "Tráfego Pago", v: 0 },
    { n: "Marketing Nacional", v: 231 },
    { n: "Royalties da Franqueadora", v: 1648 },
    { n: "Contador", v: 0 },
    { n: "Pró-labore / retirada", v: 0 },
  ];
  p.royalties = 33; // taxa de processamento da Loja
  return p;
}

/** Simulação nova (círculo zerado) com os valores pré-definidos do modelo. */
export function inputForModelo(m: Modelo): DreInput {
  return { ...structuredClone(DEFAULT_INPUT), ...structuredClone(PRESETS[m]), modelo: m };
}

function mergeItems(cur: Item[], from: Item[], to: Item[]): Item[] {
  const out: Item[] = [];
  for (const t of to) {
    const c = cur.find((x) => x.n === t.n);
    const f = from.find((x) => x.n === t.n);
    // item existe nos dois modelos: mantém o que a pessoa mexeu; se estava no padrão do modelo antigo, vai para o novo
    out.push(c ? { n: t.n, v: f && (+c.v || 0) === f.v ? t.v : c.v } : { ...t });
  }
  for (const c of cur) {
    if (to.some((x) => x.n === c.n)) continue;
    const f = from.find((x) => x.n === c.n);
    // item só do modelo antigo: some, a menos que a pessoa tenha preenchido um valor diferente do padrão
    if (f && (+c.v || 0) === f.v) continue;
    out.push(c);
  }
  return out;
}

/** Troca de modelo preservando o que foi preenchido: só os valores ainda no padrão do modelo antigo mudam. */
export function switchModelo(cur: DreInput, to: Modelo): DreInput {
  const from = PRESETS[cur.modelo ?? "home"];
  const target = PRESETS[to];
  const next: DreInput = { ...cur, modelo: to };
  for (const k of PRESET_KEYS) {
    if (k === "invest" || k === "desp") continue;
    if (cur[k] === from[k]) (next[k] as DreInput[PresetKey]) = target[k];
  }
  next.invest = mergeItems(cur.invest, from.invest, target.invest);
  next.desp = mergeItems(cur.desp, from.desp, target.desp);
  return next;
}

const RENAMES: Record<string, string> = {
  "Seguidores no Facebook": "Amigos do Facebook",
  "Seguidores no Instagram": "Amigos do Instagram",
  "Empresas onde já trabalhou": "Pessoas com quem você trabalhou",
};

/** Garante "Tráfego Pago" (zerado) e "Marketing Nacional" (R$ 231) nas despesas, sem mexer no que já foi preenchido. */
function withTrafegoPago(desp: Item[]): Item[] {
  let out = desp;
  if (!out.some((x) => x.n === "Tráfego Pago")) {
    const i = out.findIndex((x) => x.n === "Gestor de Tráfego");
    if (i >= 0) out = [...out.slice(0, i + 1), { n: "Tráfego Pago", v: 0 }, ...out.slice(i + 1)];
  }
  // "Marketing Nacional" (R$ 231) logo abaixo de "Tráfego Pago"
  if (!out.some((x) => x.n === "Marketing Nacional")) {
    const i = out.findIndex((x) => x.n === "Tráfego Pago");
    if (i >= 0) out = [...out.slice(0, i + 1), { n: "Marketing Nacional", v: 231 }, ...out.slice(i + 1)];
  }
  return out;
}

/** Atualiza nomes antigos de itens em simulações já em andamento ou salvas (os valores são mantidos). */
export function migrateInput(input: DreInput): DreInput {
  return {
    ...input,
    mercado: (input.mercado ?? []).map((x) => ({ ...x, n: RENAMES[x.n] ?? x.n })),
    // "Gestor de Tráfego" e "Marketing" saíram do investimento (a despesa mensal cobre isso); só some se estiver zerado.
    invest: (input.invest ?? []).filter((x) => !(["Gestor de Tráfego", "Marketing"].includes(x.n) && !(+x.v))),
    desp: withTrafegoPago((input.desp ?? []).map((x) => (x.n === "Marketing e tráfego pago" ? { ...x, n: "Gestor de Tráfego" } : x))),
  };
}

export interface MesDre {
  m: number;
  casos: number;
  faturamento: number;
  roy: number;
  imp: number;
  margem: number;
  fixa: number;
  resultado: number;
  acc: number;
  saldo: number;
}

export interface DreResult {
  mercado: number;
  /** % do círculo que vira lead por ano */
  pctCirculo: number;
  /** leads por mês de cada canal */
  leadsCirculo: number;
  leadsParceiros: number;
  leadsMkt: number;
  leadsMes: number;
  /** clientes por mês de cada canal (leads × conversão) */
  casosCirculo: number;
  casosParceiros: number;
  casosMkt: number;
  /** clientes novos por mês (soma dos canais) */
  casosNovos: number;
  /** clientes por mês vindos de recompra e indicação, no ritmo máximo */
  recompraMes: number;
  /** clientes por mês no ritmo máximo, já com recompra */
  casosMes: number;
  ticket: number;
  inv: number;
  fixa: number;
  meses: MesDre[];
  /** mês em que o saldo acumulado (já descontado o investimento) fica positivo */
  pay: number | null;
  pico: MesDre;
  /** clientes/mês necessários para cobrir as despesas fixas (null se a margem por cliente for ≤ 0) */
  equilibrio: number | null;
  /** quanto os clientes projetados superam o ponto de equilíbrio (1,0 = no limite) */
  folga: number | null;
  /** lucro acumulado em 36 meses ÷ investimento inicial */
  roi36: number | null;
}

export const sum = (a: Item[]) => a.reduce((s, x) => s + (+x.v || 0), 0);
export const tot = (rows: MesDre[], k: keyof MesDre) => rows.reduce((s, x) => s + (x[k] as number), 0);

export function calc(S: DreInput, ajuste = { conv: 1, mkt: 1 }): DreResult {
  const mercado = sum(S.mercado);
  const pctCirculo = credPct(S);
  // O círculo vira lead ao longo de 12 meses: 4.000 pessoas × 10% = 400 leads ÷ 12 por mês.
  const leadsCirculo = (mercado * pctCirculo) / 100 / 12;
  const leadsParceiros = (+S.parceiros || 0) * (+S.indicPorParceiro || 0);
  const leadsMkt = +S.leadsMkt || 0;
  const casosCirculo = (leadsCirculo * (+S.convCirculo || 0)) / 100 * ajuste.conv;
  const casosParceiros = (leadsParceiros * (+S.convParceiros || 0)) / 100 * ajuste.mkt;
  const casosMkt = (leadsMkt * (+S.convMkt || 0)) / 100 * ajuste.mkt;
  const casosNovos = casosCirculo + casosParceiros + casosMkt;
  const rec = Math.max(+S.recompra || 0, 0) / 100;
  const recompraMes = casosNovos * rec;
  const casosMes = casosNovos + recompraMes;
  const ticket = +S.ticket || 0;
  const inv = sum(S.invest);
  const fixa = sum(S.desp);

  const meses: MesDre[] = [];
  let acc = 0;
  let pay: number | null = null;
  const novos: number[] = [];
  for (let m = 1; m <= 36; m++) {
    const f = Math.min(m / Math.max(S.rampa, 1), 1);
    novos[m] = f * casosNovos;
    // Recompra e indicação: após 60 dias, uma fatia dos clientes captados 2 meses antes volta a comprar.
    const casos = novos[m] + (m > 2 ? rec * novos[m - 2] : 0);
    const faturamento = casos * ticket;
    const roy = (faturamento * S.royalties) / 100;
    const imp = (faturamento * S.imposto) / 100;
    const margem = faturamento - roy - imp;
    const resultado = margem - fixa;
    acc += resultado;
    const saldo = acc - inv;
    if (pay === null && saldo >= 0) pay = m;
    meses.push({ m, casos, faturamento, roy, imp, margem, fixa, resultado, acc, saldo });
  }

  const margemPorCliente = ticket * (1 - (S.royalties + S.imposto) / 100);
  const equilibrio = margemPorCliente > 0 ? fixa / margemPorCliente : null;
  return {
    mercado, pctCirculo, leadsCirculo, leadsParceiros, leadsMkt, leadsMes: leadsCirculo + leadsParceiros + leadsMkt,
    casosCirculo, casosParceiros, casosMkt, casosNovos, recompraMes, casosMes, ticket, inv, fixa, meses, pay,
    pico: meses[35],
    equilibrio,
    folga: equilibrio ? casosMes / equilibrio : null,
    roi36: inv > 0 ? meses[35].acc / inv : null,
  };
}

export const CENARIOS = [
  { id: "conservador", label: "Conservador", desc: "40% menos clientes do círculo, marketing e parceiros", ajuste: { conv: 0.6, mkt: 0.6 } },
  { id: "realista", label: "Realista", desc: "Premissas informadas", ajuste: { conv: 1, mkt: 1 } },
  { id: "otimista", label: "Otimista", desc: "30% mais clientes do círculo, marketing e parceiros", ajuste: { conv: 1.3, mkt: 1.3 } },
] as const;

export const brl = (n: number) => (n < 0 ? "-" : "") + "R$ " + Math.abs(Math.round(n)).toLocaleString("pt-BR");
export const num = (n: number) => Math.round(n).toLocaleString("pt-BR");
export function brlShort(n: number) {
  const a = Math.abs(n);
  const s = a >= 1e6 ? (a / 1e6).toFixed(1).replace(".", ",") + " mi" : a >= 1e4 ? Math.round(a / 1e3) + " mil" : Math.round(a).toLocaleString("pt-BR");
  return (n < 0 ? "-" : "") + "R$ " + s;
}
