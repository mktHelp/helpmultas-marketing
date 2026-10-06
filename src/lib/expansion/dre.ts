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
}

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
    { n: "Gestor de Tráfego", v: 1000 },
    { n: "Contador", v: 0 },
    { n: "Pró-labore / retirada", v: 0 },
  ],
  royalties: 50,
  imposto: 6,
  parceiros: 0,
  indicPorParceiro: 1.5,
  // começa zerado: o faturamento só aparece conforme o lead preenche os canais
  leadsMkt: 0,
  convCirculo: 50,
  convParceiros: 50,
  convMkt: 10,
  rampa: 6,
};

const RENAMES: Record<string, string> = {
  "Seguidores no Facebook": "Amigos do Facebook",
  "Seguidores no Instagram": "Amigos do Instagram",
  "Empresas onde já trabalhou": "Pessoas com quem você trabalhou",
};

/** Atualiza nomes antigos de itens em simulações já em andamento ou salvas (os valores são mantidos). */
export function migrateInput(input: DreInput): DreInput {
  return {
    ...input,
    mercado: (input.mercado ?? []).map((x) => ({ ...x, n: RENAMES[x.n] ?? x.n })),
    // "Gestor de Tráfego" e "Marketing" saíram do investimento (a despesa mensal cobre isso); só some se estiver zerado.
    invest: (input.invest ?? []).filter((x) => !(["Gestor de Tráfego", "Marketing"].includes(x.n) && !(+x.v))),
    desp: (input.desp ?? []).map((x) => (x.n === "Marketing e tráfego pago" ? { ...x, n: "Gestor de Tráfego" } : x)),
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
  /** clientes por mês no ritmo máximo */
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
  const casosMes = casosCirculo + casosParceiros + casosMkt;
  const ticket = +S.ticket || 0;
  const inv = sum(S.invest);
  const fixa = sum(S.desp);

  const meses: MesDre[] = [];
  let acc = 0;
  let pay: number | null = null;
  for (let m = 1; m <= 36; m++) {
    const f = Math.min(m / Math.max(S.rampa, 1), 1);
    const casos = f * casosMes;
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
    casosCirculo, casosParceiros, casosMkt, casosMes, ticket, inv, fixa, meses, pay,
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
