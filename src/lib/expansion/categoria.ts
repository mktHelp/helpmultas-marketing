// Categoria de cada despesa na DRE detalhada: CAC (aquisição de clientes), operação ou pessoal.
//
// Ordem de decisão (a IA nunca sobrescreve as anteriores):
//   1. `cat` gravado no item (já classificado pela IA nesta simulação);
//   2. regra de palavras-chave abaixo, só quando o nome é inequívoco;
//   3. se nenhuma regra reconhece o nome, a IA classifica (rota /api/expansao/categoria)
//      e o resultado fica gravado em `cat`, para o mesmo nome nunca mudar de grupo;
//   4. sem resposta válida da IA, cai em "operação".

export type Categoria = "cac" | "oper" | "pessoal";
export const CATEGORIAS: readonly Categoria[] = ["cac", "oper", "pessoal"];

/** minúsculas e sem acento, para comparar nomes digitados de qualquer jeito */
export const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const CAC = /(trafego|marketing|crm|sistema|agencia|anuncio|publicidade|propaganda|captacao)/;
const PESSOAL = /(pro-?labore|salario|comiss|fgts|inss|va e vt|vale (transporte|refeicao|alimentacao)|rescis|13o|ferias|funcionario|colaborador|retirada|encargo|beneficio)/;
const OPER = /(aluguel|agua|energia|\bluz\b|internet|telefone|contador|contabil|limpeza|condominio|iptu|seguro|manutencao|material|escritorio|papelaria|gas\b|royalt)/;

/** Categoria quando o nome é inequívoco; `null` quando nenhuma regra reconhece. */
export function categoriaPorRegra(nome: string): Categoria | null {
  const n = normalizar(nome);
  if (CAC.test(n)) return "cac";
  if (PESSOAL.test(n)) return "pessoal";
  if (OPER.test(n)) return "oper";
  return null;
}

export const categoriaDe = (item: { n: string; cat?: Categoria }): Categoria => item.cat ?? categoriaPorRegra(item.n) ?? "oper";

/** Nomes que ainda dependem da IA: sem categoria gravada, sem regra e com um nome de verdade. */
export function pendentesDeIA(itens: { n: string; cat?: Categoria }[]): string[] {
  const nomes = itens.filter((x) => !x.cat && normalizar(x.n).length >= 3 && normalizar(x.n) !== "novo item" && categoriaPorRegra(x.n) === null).map((x) => x.n.trim());
  return [...new Set(nomes)];
}
