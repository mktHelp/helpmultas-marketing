import type {
  ContentPlanPost, ContentType, PlanAccount, PlanFormat, PlanFunnel, PlanScriptBlock, PlanStatus, PlanStoryMoment,
} from "@/types/database";

export const ACCOUNT_LABEL: Record<PlanAccount, string> = {
  franchising: "@helpmultasfranchising",
  roberson: "@roberson.alvarenga",
};
export const ACCOUNT_SHORT: Record<PlanAccount, string> = { franchising: "Franchising", roberson: "Roberson" };
export const ACCOUNT_COLOR: Record<PlanAccount, string> = { franchising: "#1f4e79", roberson: "#d97706" };
/** Nome (parcial) do projeto do Hub que corresponde a cada perfil. */
export const ACCOUNT_PROJECT: Record<PlanAccount, string> = { franchising: "franqueadora", roberson: "roberson" };

export const FORMAT_LABEL: Record<PlanFormat, string> = { reels: "Reels", carrossel: "Carrossel", feed: "Feed" };
export const FORMAT_COLOR: Record<PlanFormat, string> = { reels: "#db2777", carrossel: "#7c3aed", feed: "#2563eb" };

export const FUNNEL_LABEL: Record<PlanFunnel, string> = { topo: "Topo", meio: "Meio", fundo: "Fundo" };
export const FUNNEL_COLOR: Record<PlanFunnel, string> = { topo: "#2f8f5b", meio: "#e0a900", fundo: "#c23b3b" };

export const STATUS_LABEL: Record<PlanStatus, string> = {
  planejado: "Planejado", roteirizado: "Roteiro pronto", gravado: "Gravado", publicado: "Publicado",
};
export const STATUS_COLOR: Record<PlanStatus, string> = {
  planejado: "#7c8e98", roteirizado: "#4a6a80", gravado: "#e0a900", publicado: "#2f8f5b",
};
export const STATUS_ORDER: PlanStatus[] = ["planejado", "roteirizado", "gravado", "publicado"];

export const MOMENT_LABEL: Record<PlanStoryMoment, string> = { manha: "Manhã", durante: "Durante o dia", fim: "Fim do dia", extra: "Extra" };
export const MOMENT_HINT: Record<PlanStoryMoment, string> = {
  manha: "Agenda, prioridade ou reflexão do dia, nunca só “bom dia”.",
  durante: "Reunião, equipe, visita ou problema, sempre explicando o que está em jogo.",
  fim: "Conclusão, pergunta ao público ou resposta de caixinha.",
  extra: "",
};
export const MOMENT_ORDER: PlanStoryMoment[] = ["manha", "durante", "fim", "extra"];

/** Sugestões de pilar por perfil (o campo aceita qualquer texto). */
export const PILLAR_SUGGESTIONS: Record<PlanAccount, string[]> = {
  franchising: [
    "Recurso de multa", "Multa", "Cassação da CNH", "CNH", "Multas e pontos", "Infração autossuspensiva",
    "Recusa ao bafômetro", "Notícia quente", "Bastidores Help",
  ],
  roberson: [
    "Pessoal + TBT", "Mentalidade", "Mentalidade/vendas", "Bastidores", "Estrutura Help", "História do Rober",
    "Lifestyle com propósito", "Família", "Histórias da rede", "Oportunidade Help",
  ],
};
export const OBJECTIVE_SUGGESTIONS = [
  "Aspiracional", "Atrair", "Atrair empreendedores", "Autoridade", "Confiança", "Identificação", "Desejo", "Prova social", "Conversão",
];

export const PLAN_CONTENT_TYPE: Record<PlanFormat, ContentType> = { reels: "reels", carrossel: "carrossel", feed: "feed" };

// ---- datas (sempre AAAA-MM-DD, sem fuso) ----
export const pad = (n: number) => String(n).padStart(2, "0");
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function fromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
export const todayKey = () => toKey(new Date());
export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
/** Segunda-feira da semana de `d`. */
export function startOfWeek(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}
export const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const weekdayShort = (d: Date) => WEEKDAY_SHORT[(d.getDay() + 6) % 7];
export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const fmtDayMonth = (key: string) => {
  const d = fromKey(key);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

// ---- roteiro ----
const CONFIRMAR = /\[CONFIRMAR[^\]]*\]/gi;

/** Trechos [CONFIRMAR: ...] de um texto (dados que o Rober precisa validar antes de gravar). */
export function findConfirmations(text: string | null | undefined) {
  return (text ?? "").match(CONFIRMAR) ?? [];
}

export function openPendingCount(p: Pick<ContentPlanPost, "pending">) {
  return p.pending.filter((x) => !x.done).length;
}

/** Texto do roteiro no padrão da casa, pronto para colar no teleprompter ou mandar por mensagem. */
export function scriptToText(p: ContentPlanPost) {
  const lines: string[] = [];
  lines.push(`ROTEIRO: ${p.theme.toUpperCase()}`);
  const meta = [
    p.pillar && `Pilar: ${p.pillar}`,
    p.objective && `Objetivo: ${p.objective}`,
    p.funnel && `Funil: ${FUNNEL_LABEL[p.funnel]}`,
    p.duration && `Duração: ${p.duration}`,
    p.trigger && `Gatilho: ${p.trigger}`,
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(" · "));
  for (const b of p.script_blocks as PlanScriptBlock[]) {
    lines.push("", `[${b.label.toUpperCase()}]${b.timing ? ` (${b.timing})` : ""}`, b.text);
  }
  if (p.recording_notes) lines.push("", "[GRAVAÇÃO]", p.recording_notes);
  if (p.caption) lines.push("", "[LEGENDA]", p.caption);
  if (p.cta) lines.push("", "[CTA]", p.cta);
  return lines.join("\n");
}

export function emptyPost(account: PlanAccount, date: string): Omit<ContentPlanPost, "id" | "created_at" | "updated_at" | "created_by"> {
  return {
    account, publish_date: date, format: "reels", pillar: null, theme: "", objective: null, funnel: null, pinned_slot: null,
    trigger: null, duration: null, script_blocks: [], recording_notes: null, caption: null, cta: null, no_script: false,
    pending: [], status: "planejado", task_id: null,
  };
}

/** Estrutura inicial de um Reels no padrão da casa (blocos com tempo). */
export const REELS_TEMPLATE: PlanScriptBlock[] = [
  { label: "Hook", timing: "0 a 3s", text: "" },
  { label: "Problema", timing: "3 a 15s", text: "" },
  { label: "Insight", timing: "15 a 35s", text: "" },
  { label: "Conclusão", timing: "35 a 45s", text: "" },
];
export const CAROUSEL_TEMPLATE: PlanScriptBlock[] = [
  { label: "Slide 1 (capa)", timing: "", text: "" },
  ...Array.from({ length: 7 }, (_, i) => ({ label: `Slide ${i + 2}`, timing: "", text: "" })),
  { label: "Slide 9 (CTA)", timing: "", text: "" },
];
