import { NextResponse } from "next/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { CATEGORIAS, type Categoria } from "@/lib/expansion/categoria";

// Classifica despesas novas da DRE (CAC, operação ou pessoal) usando o mesmo webhook do
// Helpinho no n8n (N8N_ASSISTENTE_WEBHOOK_URL), então não precisa de chave de IA nova.
// O formato de resposta do fluxo não é garantido: pedimos um JSON e validamos tudo aqui.
// Qualquer item sem resposta válida simplesmente não volta, e o app usa "operação".

const MAX_ITENS = 20;
const MAX_NOME = 80;

const CODIGO: Record<string, Categoria> = { CAC: "cac", OPER: "oper", OPERACAO: "oper", PESSOAL: "pessoal" };

const sem = (t: string) => t.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function prompt(nomes: string[]) {
  return [
    "Classifique cada despesa mensal de uma franquia de multas de trânsito em UMA categoria:",
    "- CAC: custo de aquisição de clientes (marketing, anúncios, tráfego pago, gestor de tráfego, CRM e sistemas de vendas, comissão de captação).",
    "- OPER: operação do dia a dia (aluguel, água, energia, internet, contador, manutenção, material, seguros, taxas).",
    "- PESSOAL: pessoas (salários, pró-labore, retirada do dono, encargos, benefícios, comissão de equipe).",
    "Responda SOMENTE com um JSON no formato {\"nome exato da despesa\": \"CAC\"}, sem texto antes ou depois, sem markdown.",
    "Despesas:",
    ...nomes.map((n) => `- ${n}`),
  ].join("\n");
}

export async function POST(request: Request) {
  const { user } = await getCurrentUserAndProfile();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const webhookUrl = process.env.N8N_ASSISTENTE_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ categorias: {} });

  const body = await request.json().catch(() => null);
  const nomes: string[] = Array.isArray(body?.nomes)
    ? [...new Set<string>(body.nomes.filter((n: unknown): n is string => typeof n === "string").map((n: string) => n.trim().slice(0, MAX_NOME)).filter(Boolean))].slice(0, MAX_ITENS)
    : [];
  if (!nomes.length) return NextResponse.json({ categorias: {} });

  let reply: unknown;
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatInput: prompt(nomes),
        // sessão própria e descartável: sem memória de conversa
        sessionId: `dre-categoria-${crypto.randomUUID()}`,
        userName: "",
        userRole: "expansao",
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return NextResponse.json({ categorias: {} });
    const data = await response.json().catch(() => null);
    reply = data?.output ?? data?.text ?? data?.reply;
  } catch {
    return NextResponse.json({ categorias: {} });
  }
  if (typeof reply !== "string") return NextResponse.json({ categorias: {} });

  // pega o primeiro objeto JSON da resposta, mesmo que o agente tenha escrito algo em volta
  const trecho = reply.match(/\{[\s\S]*\}/)?.[0];
  let bruto: Record<string, unknown> = {};
  try {
    bruto = trecho ? JSON.parse(trecho) : {};
  } catch {
    return NextResponse.json({ categorias: {} });
  }

  // só aceita nomes que foram enviados e códigos conhecidos; o resto é ignorado
  const categorias: Record<string, Categoria> = {};
  for (const nome of nomes) {
    const chave = Object.keys(bruto).find((k) => sem(k) === sem(nome));
    const valor = chave !== undefined && typeof bruto[chave] === "string" ? CODIGO[sem(bruto[chave] as string)] : undefined;
    if (valor && CATEGORIAS.includes(valor)) categorias[nome] = valor;
  }
  return NextResponse.json({ categorias });
}
