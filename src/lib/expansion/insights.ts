// Análises do DRE feitas 100% localmente (sem IA externa e sem dados de unidades):
// sensibilidade, checagem de premissas, narrativa, argumentos de reunião e
// preenchimento por texto. Tudo parte do `calc()`: aqui nada inventa número.
//
// ATENÇÃO: as faixas em BENCH são PROVISÓRIAS (a Help Multas só tem dados de venda
// de franquia, não das unidades). Ajuste aqui quando houver histórico real.

import { calc, brl, brlShort, credPct, num, type DreInput, type DreResult, type Item } from "./dre";

export const BENCH = {
  ticket: [300, 3000],
  convCirculo: [10, 60],
  convParceiros: [10, 60],
  convMkt: [2, 20],
  recompra: [0, 40],
  rampa: [3, 12],
  credLivreMax: 30,
  indicPorParceiroMax: 5,
  /** quanto do faturamento vindo de um canal só já é considerado dependência */
  dependenciaCanal: 0.7,
} as const;

const f1 = (n: number) => n.toFixed(1).replace(".", ",");
const mesTxt = (m: number | null) => (m ? `mês ${m}` : "depois do mês 36");

/* ---------------- sensibilidade ---------------- */

export interface Sensibilidade {
  id: string;
  label: string;
  /** valor atual, já formatado */
  atual: string;
  /** o que acontece se a premissa piorar 20% */
  pior: { resultadoMes: number; pay: number | null; lucro36: number };
  /** … e se melhorar 20% */
  melhor: { resultadoMes: number; pay: number | null; lucro36: number };
  /** diferença de lucro em 36 meses entre melhor e pior (ordena o ranking) */
  amplitude: number;
}

type Alavanca = { id: string; label: string; atual: (S: DreInput) => number; fmt: (n: number) => string; mexer: (S: DreInput, k: number) => DreInput; zero?: (S: DreInput) => boolean };

const scaleItems = (it: Item[], k: number): Item[] => it.map((x) => ({ ...x, v: (+x.v || 0) * k }));

const ALAVANCAS: Alavanca[] = [
  { id: "convCirculo", label: "Conversão do círculo", atual: (S) => S.convCirculo, fmt: (n) => `${f1(n)}%`, mexer: (S, k) => ({ ...S, convCirculo: S.convCirculo * k }) },
  { id: "convParceiros", label: "Conversão dos parceiros", atual: (S) => S.convParceiros, fmt: (n) => `${f1(n)}%`, mexer: (S, k) => ({ ...S, convParceiros: S.convParceiros * k }), zero: (S) => !S.parceiros },
  { id: "convMkt", label: "Conversão do marketing", atual: (S) => S.convMkt, fmt: (n) => `${f1(n)}%`, mexer: (S, k) => ({ ...S, convMkt: S.convMkt * k }), zero: (S) => !S.leadsMkt },
  { id: "leadsMkt", label: "Leads do marketing por mês", atual: (S) => S.leadsMkt, fmt: (n) => f1(n), mexer: (S, k) => ({ ...S, leadsMkt: S.leadsMkt * k }), zero: (S) => !S.leadsMkt },
  { id: "parceiros", label: "Número de parceiros", atual: (S) => S.parceiros, fmt: (n) => f1(n), mexer: (S, k) => ({ ...S, parceiros: S.parceiros * k }), zero: (S) => !S.parceiros },
  { id: "ticket", label: "Ticket médio", atual: (S) => S.ticket, fmt: brl, mexer: (S, k) => ({ ...S, ticket: S.ticket * k }) },
  { id: "recompra", label: "Recompra e indicação", atual: (S) => S.recompra, fmt: (n) => `${f1(n)}%`, mexer: (S, k) => ({ ...S, recompra: S.recompra * k }), zero: (S) => !S.recompra },
  { id: "royalties", label: "Taxa de processamento", atual: (S) => S.royalties, fmt: (n) => `${f1(n)}%`, mexer: (S, k) => ({ ...S, royalties: S.royalties * k }), zero: (S) => !S.royalties },
  { id: "desp", label: "Despesas fixas", atual: (S) => S.desp.reduce((s, x) => s + (+x.v || 0), 0), fmt: brl, mexer: (S, k) => ({ ...S, desp: scaleItems(S.desp, k) }), zero: (S) => !S.desp.some((x) => +x.v) },
  { id: "rampa", label: "Tempo até o ritmo máximo", atual: (S) => S.rampa, fmt: (n) => `${f1(n)} meses`, mexer: (S, k) => ({ ...S, rampa: S.rampa * k }) },
];

// quando o aumento da premissa PIORA o resultado (custos e prazo), o "pior" é +20%
const AUMENTAR_PIORA = new Set(["royalties", "desp", "rampa"]);

const snap = (c: DreResult) => ({ resultadoMes: c.pico.resultado, pay: c.pay, lucro36: c.meses[35].acc });

/** Quais premissas mais mexem no resultado se variarem 20% para cima ou para baixo. */
export function sensibilidade(S: DreInput, variacao = 0.2): Sensibilidade[] {
  const out: Sensibilidade[] = [];
  for (const a of ALAVANCAS) {
    if (a.zero?.(S) || !a.atual(S)) continue;
    const up = snap(calc(a.mexer(S, 1 + variacao)));
    const down = snap(calc(a.mexer(S, 1 - variacao)));
    const [pior, melhor] = AUMENTAR_PIORA.has(a.id) ? [up, down] : [down, up];
    out.push({ id: a.id, label: a.label, atual: a.fmt(a.atual(S)), pior, melhor, amplitude: Math.abs(melhor.lucro36 - pior.lucro36) });
  }
  return out.sort((x, y) => y.amplitude - x.amplitude);
}

/* ---------------- checagem de premissas ---------------- */

export type Nivel = "alerta" | "atencao" | "ok";
export interface Checagem {
  nivel: Nivel;
  titulo: string;
  texto: string;
}

const fora = (v: number, [min, max]: readonly [number, number]) => v < min || v > max;

export function checagem(S: DreInput, c: DreResult): Checagem[] {
  const out: Checagem[] = [];
  const add = (nivel: Nivel, titulo: string, texto: string) => out.push({ nivel, titulo, texto });

  if (c.mercado <= 0 && !S.parceiros && !S.leadsMkt) {
    add("alerta", "Nenhum canal de clientes preenchido", "Sem círculo, parceiros ou marketing a projeção não tem clientes. Preencha ao menos um canal.");
    return out;
  }

  if (c.equilibrio !== null && c.casosMes < c.equilibrio) {
    add("alerta", "Abaixo do ponto de equilíbrio", `Com ${f1(c.casosMes)} clientes/mês a operação não cobre as despesas fixas (precisa de ${f1(c.equilibrio)}).`);
  } else if (c.equilibrio === null) {
    add("alerta", "Sem margem por cliente", "Taxa de processamento + impostos consomem todo o ticket: cada cliente novo não paga a operação.");
  } else if (c.folga !== null && c.folga < 1.3) {
    add("atencao", "Folga pequena sobre o equilíbrio", `A projeção tem só ${f1(c.folga)}× o necessário para pagar as despesas. Uma queda pequena de vendas zera o resultado.`);
  }

  if (S.cred === "livre" && S.credLivre > BENCH.credLivreMax) add("atencao", "Credibilidade acima do usual", `${S.credLivre}% do círculo virando lead em 12 meses é otimista; o padrão máximo da tabela é 20%.`);
  if (fora(S.ticket, BENCH.ticket)) add("atencao", "Ticket fora da faixa de referência", `${brl(S.ticket)} está fora de ${brl(BENCH.ticket[0])} a ${brl(BENCH.ticket[1])}. Confirme se é o ticket real.`);
  if (c.leadsCirculo > 0 && fora(S.convCirculo, BENCH.convCirculo)) add("atencao", "Conversão do círculo atípica", `${S.convCirculo}% de conversão; a referência é de ${BENCH.convCirculo[0]}% a ${BENCH.convCirculo[1]}%.`);
  if (S.parceiros > 0 && fora(S.convParceiros, BENCH.convParceiros)) add("atencao", "Conversão dos parceiros atípica", `${S.convParceiros}% de conversão; a referência é de ${BENCH.convParceiros[0]}% a ${BENCH.convParceiros[1]}%.`);
  if (S.parceiros > 0 && S.indicPorParceiro > BENCH.indicPorParceiroMax) add("atencao", "Indicações por parceiro muito altas", `${f1(S.indicPorParceiro)} indicações/mês por parceiro é acima do que costuma acontecer.`);
  if (S.leadsMkt > 0 && fora(S.convMkt, BENCH.convMkt)) add("atencao", "Conversão do marketing atípica", `${S.convMkt}% de conversão; a referência é de ${BENCH.convMkt[0]}% a ${BENCH.convMkt[1]}%.`);
  if (S.recompra > BENCH.recompra[1]) add("atencao", "Recompra acima do usual", `${S.recompra}% de recompra é otimista; o argumento comercial fala em 20% a 30%.`);
  if (fora(S.rampa, BENCH.rampa)) add("atencao", "Tempo de rampa atípico", `${S.rampa} meses até o ritmo máximo; costuma ser de ${BENCH.rampa[0]} a ${BENCH.rampa[1]}.`);

  const total = c.casosNovos || 1;
  if (c.casosNovos > 0) {
    const [nome, share] = ([["círculo", c.casosCirculo], ["parceiros", c.casosParceiros], ["marketing", c.casosMkt]] as [string, number][]).sort((a, b) => b[1] - a[1])[0];
    if (share / total > BENCH.dependenciaCanal) add("atencao", "Resultado depende de um canal só", `${Math.round((share / total) * 100)}% dos clientes novos vêm do canal "${nome}". Vale abrir outro canal para dar segurança.`);
  }

  const prolabore = S.desp.find((d) => /pr[óo]-?labore|retirada/i.test(d.n));
  if (prolabore && !+prolabore.v) add("atencao", "Pró-labore zerado", "O resultado líquido está incluindo o salário do franqueado. Mostre também com a retirada que ele precisa.");

  // caixa: a operação pode ficar negativa antes de engrenar; o capital de giro precisa cobrir isso
  let min = 0;
  let mesMin = 0;
  for (const m of c.meses) if (m.acc < min) { min = m.acc; mesMin = m.m; }
  if (min < 0) {
    const giro = S.invest.filter((x) => /giro/i.test(x.n)).reduce((s, x) => s + (+x.v || 0), 0);
    if (giro < -min) add("atencao", "Capital de giro não cobre o início", `O caixa operacional chega a ${brl(min)} no mês ${mesMin}${giro ? ` e o capital de giro é de ${brl(giro)}` : " e não há capital de giro"}.`);
  }

  if (!c.pay) add("alerta", "Sem retorno em 36 meses", "O saldo acumulado não fica positivo no horizonte da projeção.");
  if (!out.length) add("ok", "Premissas dentro do esperado", "Nada fora das faixas de referência (provisórias).");
  return out;
}

/* ---------------- narrativa ---------------- */

const CENARIO_CONS = { conv: 0.6, mkt: 0.6 };

export function narrativa(S: DreInput, c: DreResult): string[] {
  const out: string[] = [];
  const nome = S.lead ? S.lead.split(" ")[0] : "O lead";
  out.push(
    c.pay
      ? `${nome} recupera os ${brl(c.inv)} investidos no ${mesTxt(c.pay)} e chega a ${brl(c.pico.resultado)} de resultado líquido por mês, com ${f1(c.casosMes)} clientes mensais.`
      : `Com estas premissas ${nome === "O lead" ? "o lead" : nome} não recupera os ${brl(c.inv)} investidos em 36 meses; o resultado mensal fica em ${brl(c.pico.resultado)}.`
  );

  if (c.casosNovos > 0) {
    const canais = ([["círculo", c.casosCirculo], ["parceiros", c.casosParceiros], ["marketing", c.casosMkt]] as [string, number][]).sort((a, b) => b[1] - a[1]);
    const [nome1, v1] = canais[0];
    out.push(`O que mais sustenta o resultado é o canal ${nome1} (${Math.round((v1 / c.casosNovos) * 100)}% dos clientes novos)${c.recompraMes > 0 ? `, somado a ${f1(c.recompraMes)} clientes/mês de recompra` : ""}.`);
  }

  const sens = sensibilidade(S)[0];
  if (sens) {
    out.push(
      `O maior ponto de atenção é ${sens.label.toLowerCase()} (hoje ${sens.atual}): se piorar 20%, o retorno vai para o ${mesTxt(sens.pior.pay)} e o lucro em 36 meses cai para ${brlShort(sens.pior.lucro36)}.`
    );
  }

  const cons = calc(S, CENARIO_CONS);
  out.push(
    cons.pay
      ? `Mesmo no cenário conservador (40% menos clientes) o investimento volta no ${mesTxt(cons.pay)}.`
      : `No cenário conservador (40% menos clientes) o investimento não volta em 36 meses; vale reforçar os canais antes de fechar.`
  );
  return out;
}

/* ---------------- argumentos de reunião ---------------- */

export interface Argumento {
  objecao: string;
  resposta: string;
}

export function argumentos(S: DreInput, c: DreResult): Argumento[] {
  const fat = c.meses.reduce((s, m) => s + m.faturamento, 0);
  const res = c.meses.reduce((s, m) => s + m.resultado, 0);
  const cons = calc(S, CENARIO_CONS);
  const out: Argumento[] = [];

  out.push({
    objecao: "“O investimento é alto.”",
    resposta: c.pay
      ? `São ${brl(c.inv)} que voltam no ${mesTxt(c.pay)}. Em 36 meses o lucro acumulado é ${brlShort(res)}${c.roi36 !== null ? `, ou ${f1(c.roi36)}× o que foi investido` : ""}.`
      : `Hoje o retorno passa de 36 meses com essas premissas. Vale revisar os canais de captação antes de seguir; não prometa prazo.`,
  });
  out.push({
    objecao: "“E se eu não vender tudo isso?”",
    resposta:
      c.equilibrio !== null
        ? `O ponto de equilíbrio é ${f1(c.equilibrio)} clientes/mês e a projeção tem ${f1(c.casosMes)}. No cenário conservador (40% menos) o resultado é ${brl(cons.pico.resultado)}/mês${cons.pay ? ` e o retorno vem no ${mesTxt(cons.pay)}` : ""}.`
        : "Com os custos informados a margem por cliente é zero; ajuste a taxa e o ticket antes de apresentar.",
  });
  if (c.casosNovos > 0 && c.casosCirculo / c.casosNovos < 0.5) {
    out.push({
      objecao: "“Não tenho muitos contatos.”",
      resposta: `O círculo responde por ${Math.round((c.casosCirculo / c.casosNovos) * 100)}% dos clientes. O resto vem de parceiros e marketing, que não dependem dos seus contatos.`,
    });
  } else if (c.casosNovos > 0) {
    out.push({
      objecao: "“E se meu círculo não comprar?”",
      resposta: `${Math.round((c.casosCirculo / c.casosNovos) * 100)}% dos clientes vêm do círculo. Parceiros e tráfego pago entram para reduzir essa dependência; cada parceiro novo soma ${f1(S.indicPorParceiro)} leads/mês.`,
    });
  }
  out.push({
    objecao: "“Quanto sobra para mim?”",
    resposta: fat > 0 ? `De cada R$ 100 faturados ficam R$ ${Math.max(Math.round((res / fat) * 100), 0)} com o franqueado depois de taxa, impostos e despesas. No ritmo máximo são ${brl(c.pico.resultado)} por mês.` : "Sem faturamento projetado ainda.",
  });
  out.push({
    objecao: "“Preciso de quanto de crédito no meio?”",
    resposta: `Credibilidade ${credPct(S)}% do círculo. A operação precisa de ${f1(c.equilibrio ?? 0)} clientes/mês para pagar as despesas de ${brl(c.fixa)}; abaixo disso o caixa consome o capital de giro.`,
  });
  return out;
}

/* ---------------- preencher por texto ---------------- */

const NUM = String.raw`(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(mil|k|mi)?`;
const GAP = String.raw`[^\d,;.\n]{0,28}`;

function toNumber(m: RegExpMatchArray | null, base: number): number | null {
  if (!m) return null;
  let n = parseFloat(`${m[base].replace(/\./g, "")}${m[base + 1] ? "." + m[base + 1] : ""}`);
  const mult = (m[base + 2] || "").toLowerCase();
  if (mult === "mil" || mult === "k") n *= 1000;
  if (mult === "mi") n *= 1_000_000;
  return Number.isFinite(n) ? n : null;
}

function findNumber(text: string, kw: string, order: "num-kw" | "kw-num"): number | null {
  const numFirst = () => toNumber(text.match(new RegExp(`${NUM}${GAP}(?:${kw})`, "i")), 1);
  const kwFirst = () => toNumber(text.match(new RegExp(`(?:${kw})${GAP}${NUM}`, "i")), 1);
  return order === "num-kw" ? numFirst() ?? kwFirst() : kwFirst() ?? numFirst();
}

export interface Leitura {
  patch: Partial<DreInput>;
  /** o que foi entendido, para o consultor conferir antes de aplicar */
  entendido: { campo: string; valor: string }[];
}

const MERCADO_KW: [string, string][] = [
  ["Contatos de WhatsApp", "whats\\w*|zap"],
  ["Amigos do Instagram", "instagram|insta"],
  ["Amigos do Facebook", "facebook|face"],
  ["Família (tios, primos, parentes)", "fam[ií]lia|parentes|primos|tios"],
  ["Amigos próximos", "amigos pr[óo]ximos"],
  ["Pessoas com quem você trabalhou", "trabalh\\w*|colegas|ex-?colegas"],
];

const CUSTO_KW: [string, string, "invest" | "desp"][] = [
  ["Aluguel", "aluguel", "desp"],
  ["Água", "[áa]gua", "desp"],
  ["Energia", "energia|luz", "desp"],
  ["Internet e telefone", "internet|telefone", "desp"],
  ["Contador", "contador|contabilidade", "desp"],
  ["Pró-labore", "pr[óo]-?labore|retirada|sal[áa]rio", "desp"],
  ["Gestor de Tráfego", "gestor de tr[áa]fego", "desp"],
  ["Tráfego Pago", "tr[áa]fego pago|an[úu]ncios?", "desp"],
  ["Capital de giro", "capital de giro|giro", "invest"],
  ["Estrutura", "estrutura|sala|reforma", "invest"],
  ["Equipamentos", "equipamentos?|computador|notebook", "invest"],
];

/** Lê uma descrição livre do lead ("300 contatos no whatsapp, 8 parceiros, aluguel de 2 mil") e devolve o que dá para preencher. */
export function lerTexto(text: string, S: DreInput): Leitura {
  const patch: Partial<DreInput> = {};
  const entendido: Leitura["entendido"] = [];

  const mercado = S.mercado.map((x) => ({ ...x }));
  let mexeuMercado = false;
  for (const [nome, kw] of MERCADO_KW) {
    const v = findNumber(text, kw, "num-kw");
    if (v === null) continue;
    const alvo = mercado.find((x) => x.n === nome);
    if (!alvo) continue;
    alvo.v = v;
    mexeuMercado = true;
    entendido.push({ campo: nome, valor: v.toLocaleString("pt-BR") });
  }
  if (mexeuMercado) patch.mercado = mercado;

  const parceiros = findNumber(text, "parceiros?", "num-kw");
  if (parceiros !== null) {
    patch.parceiros = parceiros;
    entendido.push({ campo: "Parceiros na região", valor: String(parceiros) });
  }
  const ticket = findNumber(text, "ticket(?: m[ée]dio)?|valor m[ée]dio", "kw-num");
  if (ticket !== null) {
    patch.ticket = ticket;
    entendido.push({ campo: "Ticket médio", valor: brl(ticket) });
  }
  const leadsMkt = findNumber(text, "leads?(?: por m[êe]s)?(?: de| do| no)? (?:marketing|tr[áa]fego)|marketing gera", "kw-num");
  if (leadsMkt !== null) {
    patch.leadsMkt = leadsMkt;
    entendido.push({ campo: "Leads do marketing/mês", valor: String(leadsMkt) });
  }

  const desp = S.desp.map((x) => ({ ...x }));
  const invest = S.invest.map((x) => ({ ...x }));
  let mexeuDesp = false;
  let mexeuInvest = false;
  for (const [nome, kw, onde] of CUSTO_KW) {
    // "tráfego pago" não pode cair em "gestor de tráfego" e vice-versa
    const v = findNumber(text, kw, "kw-num");
    if (v === null) continue;
    const lista = onde === "desp" ? desp : invest;
    const alvo = lista.find((x) => x.n.toLowerCase().startsWith(nome.toLowerCase()));
    if (!alvo) continue;
    alvo.v = v;
    if (onde === "desp") mexeuDesp = true;
    else mexeuInvest = true;
    entendido.push({ campo: `${onde === "desp" ? "Despesa" : "Investimento"}: ${alvo.n}`, valor: brl(v) });
  }
  if (mexeuDesp) patch.desp = desp;
  if (mexeuInvest) patch.invest = invest;
  return { patch, entendido };
}

/* ---------------- comparação de simulações salvas ---------------- */

export type CriterioRanking = "recentes" | "retorno" | "lucro" | "roi";

/** Ordena as salvas pelo critério; os sem dado vão para o fim. */
export function ordenarSalvas<T extends { summary: { retornoMes?: number | null; lucro36m?: number; roi36?: number | null } }>(rows: T[], criterio: CriterioRanking): T[] {
  if (criterio === "recentes") return rows;
  const chave = (r: T): number | null => {
    if (criterio === "retorno") return r.summary.retornoMes ? -r.summary.retornoMes : null; // menor mês = melhor
    if (criterio === "lucro") return r.summary.lucro36m ?? null;
    return r.summary.roi36 ?? null;
  };
  return [...rows].sort((a, b) => {
    const x = chave(a);
    const y = chave(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x;
  });
}

/* ---------------- insights para o lead durante a montagem ---------------- */

// Quem lê estes textos é o lead interessado na franquia, não o consultor: falam com
// ele ("você"), destacam o que já é bom e mostram quanto dá para ganhar a mais.
// Todo número vem do `calc()`; nada aqui promete resultado além da projeção.

export interface Insight {
  tipo: "destaque" | "oportunidade";
  /** número de impacto, mostrado em tamanho grande */
  valor?: string;
  titulo: string;
  texto: string;
}

export interface Ganho {
  label: string;
  /** quanto o lucro acumulado em 36 meses sobe com a mudança */
  dLucro: number;
  de: number | null;
  para: number | null;
}

function ganho(S: DreInput, c: DreResult, label: string, alt: DreInput): Ganho | null {
  const r = calc(alt);
  const dLucro = r.meses[35].acc - c.meses[35].acc;
  return dLucro > 0 ? { label, dLucro, de: c.pay, para: r.pay } : null;
}

const prazoTxt = (g: Ganho) =>
  g.para && g.de && g.para < g.de ? ` e o seu investimento volta mais cedo: do mês ${g.de} para o mês ${g.para}` : g.para && !g.de ? ` e o investimento passa a voltar já no mês ${g.para}` : "";

/** Alavancas que melhorariam o resultado, da que mais rende para a que menos rende. */
export function oportunidades(S: DreInput, c: DreResult): Ganho[] {
  const list: (Ganho | null)[] = [];
  if (S.indicPorParceiro > 0 && S.convParceiros > 0) list.push(ganho(S, c, "Mais 2 parceiros na sua região", { ...S, parceiros: S.parceiros + 2 }));
  if (S.convMkt > 0) list.push(ganho(S, c, "Mais 50 leads por mês do marketing", { ...S, leadsMkt: S.leadsMkt + 50 }));
  if (c.mercado > 0) list.push(ganho(S, c, "Converter 10 pontos a mais do seu círculo", { ...S, convCirculo: Math.min(S.convCirculo + 10, 100) }));
  list.push(ganho(S, c, "Ticket médio 10% maior", { ...S, ticket: S.ticket * 1.1 }));
  if (S.recompra < 100) list.push(ganho(S, c, "10 pontos a mais de recompra", { ...S, recompra: S.recompra + 10 }));
  if (S.rampa > 3) list.push(ganho(S, c, "Chegar ao ritmo máximo 2 meses antes", { ...S, rampa: S.rampa - 2 }));
  return list.filter((g): g is Ganho => g !== null).sort((a, b) => b.dLucro - a.dLucro);
}

const fraseGanho = (g: Ganho) => `o seu lucro em 36 meses sobe ${brlShort(g.dLucro)}${prazoTxt(g)}.`;
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Insights da etapa em andamento: sempre positivos, falando direto com o lead. */
export function insightsEtapa(step: number, S: DreInput, c: DreResult): Insight[] {
  const out: Insight[] = [];
  const D = (titulo: string, texto: string, valor?: string) => out.push({ tipo: "destaque", titulo, texto, valor });
  const O = (titulo: string, texto: string, valor?: string) => out.push({ tipo: "oportunidade", titulo, texto, valor });
  const ops = oportunidades(S, c);
  const margemCliente = c.ticket * (1 - (S.royalties + S.imposto) / 100);
  const lucroPositivo = c.pico.resultado > 0;

  if (step === 0) {
    if (c.mercado <= 0) {
      D("Você já começa com uma rede pronta", "Família, amigos e contatos do WhatsApp são o seu primeiro mercado. Aqui você vê quanto essa rede vale em clientes e em faturamento.");
    } else {
      D("Só a sua rede já trabalha por você", `${num(c.mercado)} pessoas que você conhece geram cerca de ${f1(c.leadsCirculo)} potenciais clientes por mês, sem gastar com anúncio.`, `${f1(c.leadsCirculo)} leads/mês`);
      const porCem = (100 * credPct(S) * S.convCirculo) / 10000;
      if (porCem > 0) O("Cada 100 contatos valem dinheiro", `A cada 100 pessoas a mais na sua rede são cerca de ${f1(porCem)} clientes por ano, ${brl(porCem * c.ticket)} de faturamento.`, `+${brl(porCem * c.ticket)}/ano`);
      if (S.cred !== "alta") {
        const g = ganho(S, c, "Credibilidade alta", { ...S, cred: "alta" });
        if (g) O("Sua reputação acelera o resultado", `Quanto mais confiam em você, mais gente vira cliente: com credibilidade alta ${fraseGanho(g)}`, `+${brlShort(g.dLucro)}`);
      }
    }
    if (S.parceiros < 5) {
      const g = ganho(S, c, "Chegar a 5 parceiros", { ...S, parceiros: 5 });
      if (g) O("Parceiros multiplicam os seus clientes", `Com 5 parceiros indicando clientes ${fraseGanho(g)}`, `+${brlShort(g.dLucro)}`);
    }
  }

  if (step === 1) {
    if (c.ticket > 0 && margemCliente > 0) D("É isso que fica de cada cliente", `De um ticket de ${brl(c.ticket)}, ${brl(margemCliente)} é margem depois da taxa de processamento e dos impostos.`, brl(margemCliente));
    if (c.casosMes > 0) D("Faturamento que a operação alcança", `Com ${f1(c.casosMes)} clientes por mês, no ritmo máximo, a sua operação fatura ${brl(c.casosMes * c.ticket)} por mês.`, `${brl(c.casosMes * c.ticket)}/mês`);
    const t = ops.find((g) => g.label.includes("Ticket"));
    if (t) O("Valorizar o serviço compensa", `Com um ticket 10% maior ${fraseGanho(t)}`, `+${brlShort(t.dLucro)}`);
    if (!out.length) D("Cada cliente conta", "O ticket médio define quanto cada cliente fechado soma no seu faturamento. É a base de toda a projeção.");
  }

  if (step === 2) {
    if (c.roi36 !== null && c.roi36 > 0) D("O seu investimento se multiplica", `Em 36 meses o lucro acumulado chega a ${f1(c.roi36)} vezes os ${brl(c.inv)} investidos.`, `${f1(c.roi36)}×`);
    if (c.pay) D("O dinheiro volta", `O investimento retorna no mês ${c.pay}${lucroPositivo ? `, e a partir daí a operação segue gerando ${brl(c.pico.resultado)} de lucro por mês` : ""}.`, `Mês ${c.pay}`);
    const giro = S.invest.filter((x) => /giro/i.test(x.n)).reduce((s, x) => s + (+x.v || 0), 0);
    if (giro > 0 && c.fixa > 0) D("Você começa com fôlego", `O capital de giro cobre ${f1(giro / c.fixa)} meses de despesas fixas enquanto a operação ganha ritmo.`, `${f1(giro / c.fixa)} meses`);
    if (!out.length) D("Veja o retorno logo adiante", "Com o investimento definido, o simulador mostra em que mês ele volta e quanto sobra depois.");
  }

  if (step === 3) {
    const prolabore = S.desp.find((d) => /pr[óo]-?labore|retirada/i.test(d.n));
    if (c.equilibrio !== null) {
      if (c.casosMes >= c.equilibrio && c.casosMes > 0) D("Poucos clientes pagam a operação inteira", `Com ${f1(c.equilibrio)} clientes por mês todas as despesas ficam pagas. A projeção é de ${f1(c.casosMes)}${c.folga ? `, ${f1(c.folga)} vezes mais` : ""}.`, `${f1(c.equilibrio)} clientes`);
      else if (c.casosMes > 0) D("Você está no caminho", `Faltam ${f1(c.equilibrio - c.casosMes)} clientes por mês para pagar todas as despesas. Parceiros e marketing são os atalhos para chegar lá.`, `${f1(c.equilibrio)} clientes`);
      else D("Veja quanto a operação precisa", `Com estes custos, ${f1(c.equilibrio)} clientes por mês pagam todas as despesas.`, `${f1(c.equilibrio)} clientes`);
    }
    if (prolabore && +prolabore.v > 0 && lucroPositivo) D("O seu salário já está incluído", `A retirada de ${brl(+prolabore.v)} por mês já está nas contas e, ainda assim, sobram ${brl(c.pico.resultado)} de lucro.`, brl(+prolabore.v));
    if (S.royalties + S.imposto > 0 && S.royalties + S.imposto < 100 && c.ticket > 0) D("A maior parte do que entra é sua", `Só ${f1(S.royalties + S.imposto)}% do faturamento vai para taxa e impostos; os outros ${f1(100 - S.royalties - S.imposto)}% cobrem a operação e o seu lucro.`, `${f1(100 - S.royalties - S.imposto)}%`);
  }

  if (step === 4) {
    if (c.casosNovos <= 0) {
      D("Três caminhos para trazer clientes", "Sua rede de contatos, parceiros que indicam e anúncios trabalham juntos. Quanto mais canais, mais rápido o retorno.");
    } else {
      const canais = ([["círculo", c.casosCirculo], ["parceiros", c.casosParceiros], ["marketing", c.casosMkt]] as [string, number][]).sort((a, b) => b[1] - a[1]);
      D(`${maiuscula(canais[0][0])} é o seu canal mais forte`, `Responde por ${Math.round((canais[0][1] / c.casosNovos) * 100)}% dos clientes novos, e há outros canais trabalhando junto.`, `${Math.round((canais[0][1] / c.casosNovos) * 100)}%`);
      if (c.recompraMes > 0) D("Clientes que voltam e indicam", `Depois de 60 dias parte dos clientes volta a comprar e indica amigos: são ${f1(c.recompraMes)} clientes a mais por mês, sem esforço de captação.`, `+${f1(c.recompraMes)}/mês`);
    }
    for (const g of ops.slice(0, 2)) O(g.label, maiuscula(fraseGanho(g)), `+${brlShort(g.dLucro)}`);
  }

  return out.slice(0, 4);
}
