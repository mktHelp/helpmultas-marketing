// Simulador de DRE do franqueado (área da Expansão): cálculo puro, sem dependência
// de React. Os valores padrão abaixo são fixos (base: simulação real já aprovada) e
// todos podem ser alterados na tela para cada lead; nada vem de fontes externas.

export const REGIOES = ["Sul", "Sudeste", "Centro-Oeste", "Nordeste", "Norte"] as const;
export type Regiao = "Brasil" | (typeof REGIOES)[number];

export const CRED = { alta: 1, media: 0.7, baixa: 0.4 } as const;
export type Cred = keyof typeof CRED;

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
  /** parceiros que o lead consegue fechar e quantos casos cada um indica por mês */
  parceiros: number;
  indicPorParceiro: number;
  conv: number;
  rampa: number;
}

export const DEFAULT_INPUT: DreInput = {
  lead: "",
  // O círculo é de cada lead: começa zerado para ser preenchido.
  mercado: [
    { n: "Família (tios, primos, parentes)", v: 0 },
    { n: "Amigos próximos", v: 0 },
    { n: "Empresas onde já trabalhou", v: 0 },
    { n: "Contatos de WhatsApp", v: 0 },
    { n: "Seguidores no Facebook", v: 0 },
    { n: "Seguidores no Instagram", v: 0 },
  ],
  cred: "media",
  regiao: "Brasil",
  ticket: 1000,
  invest: [
    { n: "Taxa de adesão à rede", v: 29900 },
    { n: "Estrutura (home office / sala)", v: 2000 },
    { n: "Equipamentos e sistemas", v: 4500 },
    { n: "Marketing de lançamento", v: 3000 },
    { n: "Capital de giro", v: 3000 },
  ],
  desp: [
    { n: "Internet e telefone", v: 200 },
    { n: "Sistemas / CRM", v: 595 },
    { n: "Marketing e tráfego pago", v: 1000 },
    { n: "Contador", v: 300 },
    { n: "Pró-labore / retirada", v: 0 },
  ],
  royalties: 45,
  imposto: 6,
  dirige: 75,
  multa: 30,
  conv: 24,
  mkt: 20,
  parceiros: 0,
  indicPorParceiro: 1.5,
  rampa: 6,
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
  casosMkt: number;
  /** indicações dos parceiros por mês (parceiros × média por parceiro) */
  casosParceiros: number;
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
  const cf = CRED[S.cred];
  const dirigem = (mercado * S.dirige) / 100;
  const comMulta = (dirigem * S.multa) / 100 * cf;
  const fecham = ((comMulta * S.conv) / 100) * ajuste.conv;
  const casosCirculo = fecham / 12;
  const casosMkt = (+S.mkt || 0) * ajuste.mkt;
  const casosParceiros = (+S.parceiros || 0) * (+S.indicPorParceiro || 0) * ajuste.mkt;
  const casosMes = casosCirculo + casosMkt + casosParceiros;
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
    mercado, dirigem, comMulta, fecham, casosCirculo, casosMkt, casosParceiros, casosMes, ticket, inv, fixa, meses, pay,
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
