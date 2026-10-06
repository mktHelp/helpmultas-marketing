// Simulador de DRE do franqueado (área da Expansão): dados de referência da
// rede + cálculo puro. Sem dependência de React, pra poder testar/reaproveitar.

export const REGIOES = ["Sul", "Sudeste", "Centro-Oeste", "Nordeste", "Norte"] as const;
export type Regiao = "Brasil" | (typeof REGIOES)[number];

// Atualize aqui quando a base da rede mudar.
export const DRE_DATA = {
  atualizadoEm: "2026-10-06",
  fonteTicket: "Ticket médio (faturamento ÷ vendas) de 01/01/2026 a 06/10/2026",
  ticketMedio: 650,
  ticketPorRegiao: { Sul: 660, Sudeste: 520, "Centro-Oeste": 1080, Nordeste: 830, Norte: 860 } as Record<string, number>,
  // % de multados por ano = baseMulta × índice regional (o Senatran informa nº de infrações, não de pessoas).
  baseMulta: 30,
  perfilFonte: "Senatran (condutores habilitados nov/2025; infrações com NP 2025) e IBGE (população jul/2025)",
  perfil: {
    Brasil: { dirige: 41, indice: 1.0 },
    Sul: { dirige: 54, indice: 0.97 },
    Sudeste: { dirige: 49, indice: 1.05 },
    "Centro-Oeste": { dirige: 47, indice: 1.21 },
    Nordeste: { dirige: 25, indice: 0.84 },
    Norte: { dirige: 25, indice: 0.78 },
  } as Record<string, { dirige: number; indice: number }>,
  vendasInicio: "2026-01-01",
  vendasFim: "2026-10-06",
  vendas: {
    Sul: { vendas: 14187, unidades: 56 },
    Sudeste: { vendas: 1895, unidades: 14 },
    "Centro-Oeste": { vendas: 42, unidades: 5 },
    Nordeste: { vendas: 219, unidades: 11 },
    Norte: { vendas: 245, unidades: 6 },
  } as Record<string, { vendas: number; unidades: number }>,
};

export const CRED = { alta: 1, media: 0.7, baixa: 0.4 } as const;
export type Cred = keyof typeof CRED;

export const ticketOf = (r: string) => (r !== "Brasil" && DRE_DATA.ticketPorRegiao[r]) || DRE_DATA.ticketMedio;

/** Vendas por unidade por mês na rede (região ou Brasil) — base do campo "casos via marketing". */
export function mktOf(r: string) {
  const v = DRE_DATA.vendas;
  const meses = (Date.parse(DRE_DATA.vendasFim) - Date.parse(DRE_DATA.vendasInicio)) / 864e5 / 30.44;
  const rs = r === "Brasil" ? Object.values(v) : v[r] ? [v[r]] : Object.values(v);
  const vendas = rs.reduce((s, x) => s + x.vendas, 0);
  const un = rs.reduce((s, x) => s + x.unidades, 0);
  return { vendas, un, meses, mkt: Math.ceil(vendas / un / meses) };
}

export function perfilOf(r: string) {
  const p = DRE_DATA.perfil[r] || DRE_DATA.perfil.Brasil;
  return { dirige: p.dirige, multa: Math.round(DRE_DATA.baseMulta * p.indice), mkt: mktOf(r).mkt };
}

export interface Item {
  n: string;
  v: number;
}

export interface DreInput {
  lead: string;
  mercado: Item[];
  cred: Cred;
  regiao: string;
  ticket: number;
  invest: Item[];
  desp: Item[];
  royalties: number;
  imposto: number;
  dirige: number;
  multa: number;
  mkt: number;
  conv: number;
  rampa: number;
}

export const DEFAULT_INPUT: DreInput = {
  lead: "",
  mercado: [
    { n: "Família (tios, primos, parentes)", v: 80 },
    { n: "Amigos próximos", v: 150 },
    { n: "Empresas onde já trabalhou", v: 300 },
    { n: "Contatos de WhatsApp", v: 600 },
    { n: "Seguidores no Facebook", v: 800 },
    { n: "Seguidores no Instagram", v: 1500 },
  ],
  cred: "alta",
  regiao: "Brasil",
  ticket: DRE_DATA.ticketMedio,
  invest: [
    { n: "Taxa de adesão à rede", v: 0 },
    { n: "Estrutura (home office / sala)", v: 3000 },
    { n: "Equipamentos e sistemas", v: 2000 },
    { n: "Marketing de lançamento", v: 3000 },
    { n: "Capital de giro", v: 3000 },
  ],
  desp: [
    { n: "Internet e telefone", v: 200 },
    { n: "Sistemas / CRM", v: 300 },
    { n: "Marketing e tráfego pago", v: 1000 },
    { n: "Contador", v: 300 },
    { n: "Pró-labore / retirada", v: 0 },
  ],
  royalties: 10,
  imposto: 6,
  conv: 25,
  rampa: 6,
  ...perfilOf("Brasil"),
};

export interface MesDre {
  m: number;
  ano: number;
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
  dirigem: number;
  comMulta: number;
  fecham: number;
  casosCirculo: number;
  casosMes: number;
  ticket: number;
  inv: number;
  fixa: number;
  meses: MesDre[];
  /** mês em que o saldo acumulado (já descontado o investimento) fica positivo */
  pay: number | null;
  pico: MesDre;
  /** casos/mês necessários para cobrir as despesas fixas (null se a margem por caso for ≤ 0) */
  equilibrio: number | null;
  /** quanto os casos projetados superam o ponto de equilíbrio (1,0 = no limite) */
  folga: number | null;
  /** lucro acumulado em 36 meses ÷ investimento inicial */
  roi36: number | null;
}

export const sum = (a: Item[]) => a.reduce((s, x) => s + (+x.v || 0), 0);
export const tot = (rows: MesDre[], k: keyof MesDre) => rows.reduce((s, x) => s + (x[k] as number), 0);

export function calc(S: DreInput, ajuste = { conv: 1, mkt: 1 }): DreResult {
  const mercado = sum(S.mercado);
  const cf = CRED[S.cred];
  const dirigem = (mercado * S.dirige) / 100;
  const comMulta = (dirigem * S.multa) / 100 * cf;
  const fecham = ((comMulta * S.conv) / 100) * ajuste.conv;
  const casosCirculo = fecham / 12;
  const casosMes = casosCirculo + (+S.mkt || 0) * ajuste.mkt;
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
    meses.push({ m, ano: Math.ceil(m / 12), casos, faturamento, roy, imp, margem, fixa, resultado, acc, saldo });
  }

  const margemPorCaso = ticket * (1 - (S.royalties + S.imposto) / 100);
  const equilibrio = margemPorCaso > 0 ? fixa / margemPorCaso : null;
  return {
    mercado, dirigem, comMulta, fecham, casosCirculo, casosMes, ticket, inv, fixa, meses, pay,
    pico: meses[35],
    equilibrio,
    folga: equilibrio ? casosMes / equilibrio : null,
    roi36: inv > 0 ? meses[35].acc / inv : null,
  };
}

export const CENARIOS = [
  { id: "conservador", label: "Conservador", desc: "40% menos contratos do círculo e 40% menos casos de marketing", ajuste: { conv: 0.6, mkt: 0.6 } },
  { id: "realista", label: "Realista", desc: "Premissas informadas", ajuste: { conv: 1, mkt: 1 } },
  { id: "otimista", label: "Otimista", desc: "30% mais contratos e 30% mais casos de marketing", ajuste: { conv: 1.3, mkt: 1.3 } },
] as const;

export const brl = (n: number) => (n < 0 ? "-" : "") + "R$ " + Math.abs(Math.round(n)).toLocaleString("pt-BR");
export const num = (n: number) => Math.round(n).toLocaleString("pt-BR");
export function brlShort(n: number) {
  const a = Math.abs(n);
  const s = a >= 1e6 ? (a / 1e6).toFixed(1).replace(".", ",") + " mi" : a >= 1e4 ? Math.round(a / 1e3) + " mil" : Math.round(a).toLocaleString("pt-BR");
  return (n < 0 ? "-" : "") + "R$ " + s;
}
