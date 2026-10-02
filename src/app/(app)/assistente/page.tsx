"use client";

import { Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDown,
  Bot,
  CalendarDays,
  Check,
  Copy,
  Gauge,
  ListChecks,
  Megaphone,
  PanelLeft,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Send,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Markdown } from "@/components/assistant/Markdown";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { ShareMenu } from "./ShareMenu";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  author?: { full_name: string; avatar_url?: string | null } | null;
  /** resposta recém-chegada: anima a entrada (histórico carregado não anima) */
  fresh?: boolean;
  /** mensagem que não chegou ao assistente: mostra "tentar novamente" */
  failed?: boolean;
}

interface Member {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  title: string;
  preview: string;
  updated_at: string;
  user_id: string;
  isOwner: boolean;
  owner?: { full_name: string; avatar_url: string | null } | null;
  members?: Member[];
}

type HistoryState = "loading" | "ready" | "error";

const SUGESTOES = [
  { icon: ListChecks, label: "Tarefas", prompt: "Quais são as tarefas mais urgentes?" },
  { icon: CalendarDays, label: "Agenda", prompt: "O que vai ser publicado nos próximos 7 dias?" },
  { icon: TrendingUp, label: "Instagram", prompt: "Como foi o desempenho do Instagram nos últimos 30 dias?" },
  { icon: Megaphone, label: "Tráfego pago", prompt: "Quanto gastamos em anúncios nos últimos 7 dias e quantos leads vieram?" },
  { icon: Gauge, label: "Leads", prompt: "Quantos leads recebemos esta semana, por campanha?" },
  { icon: PenLine, label: "Roteiros", prompt: "Escreva um roteiro de 1 minuto no meu estilo sobre recurso de multa e salve no teleprompter" },
];

/** Chave usada pelo Teleprompter para entregar um texto ao chat (ver AiPanel). */
const HANDOFF_KEY = "hm-helpinho-handoff";

const THINKING_STEPS = [
  "Entendendo sua pergunta…",
  "Consultando os dados do Hub…",
  "Cruzando as informações…",
  "Montando a resposta…",
];

// Detecta pedidos de criar tarefa direto na mensagem (sem precisar da IA),
// pra abrir o formulário completo em vez de ficar perguntando campo por
// campo no chat. Retorna o texto restante (possível título) ou null se a
// mensagem não for um pedido de criação.
function detectCreateTaskIntent(text: string): string | null {
  const patterns = [
    /^\s*(?:crie|criar|cria)\s+(?:uma\s+)?(?:nova\s+)?tarefas?\s*(?:nova)?\s*(?:sobre|pra|para|de|:)?\s*(.*)$/i,
    /^\s*nova\s+tarefas?\s*(?:sobre|pra|para|de|:)?\s*(.*)$/i,
  ];
  for (const pattern of patterns) {
    const match = text.trim().match(pattern);
    if (match) return match[1]?.trim() || "";
  }
  return null;
}

function truncate(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const diff = differenceInCalendarDays(new Date(), d);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

function groupLabel(iso: string) {
  const diff = differenceInCalendarDays(new Date(), new Date(iso));
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff <= 7) return "Últimos 7 dias";
  return "Mais antigas";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function AssistentePage() {
  return (
    <Suspense fallback={null}>
      <AssistenteContent />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/* Peças visuais                                                       */
/* ------------------------------------------------------------------ */

function HelpinhoAvatar({ size = "sm", live = false }: { size?: "sm" | "md"; live?: boolean }) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-blue-900 shadow-sm",
        size === "sm" ? "h-8 w-8" : "h-10 w-10"
      )}
    >
      {live && <span className="ast-ring absolute inset-0 rounded-full bg-yellow-500/50" aria-hidden />}
      <Bot className={cn("relative text-yellow-500", size === "sm" ? "h-4 w-4" : "h-5 w-5")} />
    </span>
  );
}

function ThinkingBubble() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const step = Math.min(Math.floor(elapsed / 3), THINKING_STEPS.length - 1);
  const slow = elapsed >= 25;

  return (
    <div className="ast-msg-in flex items-end gap-2.5" role="status" aria-live="polite">
      <HelpinhoAvatar live />
      <div className="flex items-center gap-3 rounded-2xl rounded-bl-md bg-gray-050 px-4 py-3">
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="ast-dot h-1.5 w-1.5 rounded-full bg-blue-700" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </span>
        <span key={slow ? "slow" : step} className="ast-shimmer-text ast-msg-in text-[13px] font-semibold">
          {slow ? "Essa consulta está demorando, continuo trabalhando…" : THINKING_STEPS[step]}
        </span>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard indisponível (http, permissão negada): ignora sem quebrar
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copiado!" : "Copiar resposta"}
      aria-label="Copiar resposta"
      className={cn(
        "flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors",
        copied ? "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]" : "text-gray-400 hover:bg-gray-100 hover:text-blue-900"
      )}
    >
      {copied ? <Check className="ast-pop h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  profileName,
  profileAvatar,
  onRetry,
}: {
  message: ChatMessage;
  isOwn: boolean;
  profileName: string;
  profileAvatar: string | null;
  onRetry: (m: ChatMessage) => void;
}) {
  const isUser = message.role === "user";
  const authorName = isUser ? message.author?.full_name : null;
  const time = message.created_at ? format(new Date(message.created_at), "HH:mm") : "";

  return (
    <div className={cn("ast-msg-in group flex items-end gap-2.5", isUser && isOwn && "flex-row-reverse")}>
      {isUser ? (
        <UserAvatar name={authorName || profileName || "Você"} avatarUrl={isOwn ? profileAvatar : message.author?.avatar_url ?? null} size="sm" />
      ) : (
        <HelpinhoAvatar />
      )}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col sm:max-w-[78%]", isUser && isOwn && "items-end")}>
        {isUser && authorName && !isOwn && (
          <span className="mb-0.5 px-1 text-[11px] font-semibold text-gray-400">{authorName}</span>
        )}
        <div
          className={cn(
            "min-w-0 max-w-full rounded-2xl px-4 py-2.5 text-sm shadow-[var(--shadow-sm)]",
            isUser
              ? "whitespace-pre-wrap break-words rounded-br-md bg-yellow-500 text-blue-900"
              : "rounded-bl-md bg-gray-050 text-blue-900",
            isUser && !isOwn && "rounded-bl-md rounded-br-2xl bg-blue-100",
            message.failed && "opacity-60"
          )}
        >
          {isUser ? message.content : <Markdown reveal={message.fresh}>{message.content}</Markdown>}
        </div>
        <div className={cn("mt-1 flex items-center gap-2 px-1", isUser && isOwn && "flex-row-reverse")}>
          {time && <span className="text-[10px] font-semibold text-gray-300">{time}</span>}
          {!isUser && <CopyButton text={message.content} />}
          {message.failed && (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="flex h-6 items-center gap-1 rounded-full bg-[color:var(--color-danger-bg)] px-2 text-[11px] font-semibold text-[color:var(--color-danger)] hover:brightness-95"
            >
              <RotateCcw className="h-3 w-3" />
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

function HistorySkeleton() {
  return (
    <div className="space-y-5" aria-label="Carregando conversa" role="status">
      {[
        { own: false, w: "w-3/5" },
        { own: true, w: "w-2/5" },
        { own: false, w: "w-4/5" },
      ].map((row, i) => (
        <div key={i} className={cn("flex items-end gap-2.5", row.own && "flex-row-reverse")}>
          <span className="ast-skeleton h-8 w-8 shrink-0 rounded-full" />
          <span className={cn("ast-skeleton h-14 rounded-2xl", row.w)} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lista de conversas                                                  */
/* ------------------------------------------------------------------ */

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  pendingIds: Set<string>;
  query: string;
  setQuery: (q: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  shareMenuFor: string | null;
  setShareMenuFor: (id: string | null) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
  onMembersChange: (conversationId: string, members: Member[]) => void;
}

function ConversationList(props: ConversationListProps) {
  const {
    conversations,
    activeId,
    loading,
    error,
    pendingIds,
    query,
    setQuery,
    confirmDeleteId,
    setConfirmDeleteId,
    shareMenuFor,
    setShareMenuFor,
    onSelect,
    onNew,
    onDelete,
    onRetry,
    onMembersChange,
  } = props;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q) || c.preview?.toLowerCase().includes(q));
  }, [conversations, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    for (const c of filtered) {
      const label = groupLabel(c.updated_at);
      map.set(label, [...(map.get(label) ?? []), c]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2.5 p-3">
        <button
          type="button"
          onClick={onNew}
          className="group flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-yellow-500 font-display text-[13px] font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
          Nova conversa
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversas"
            aria-label="Buscar conversas"
            className="h-9 w-full rounded-full border border-gray-200 bg-gray-050 pl-8 pr-8 text-xs outline-none transition-colors focus:border-blue-900 focus:bg-white"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2.5 pb-3">
        {loading && conversations.length === 0 && (
          <div className="space-y-2 px-0.5" role="status" aria-label="Carregando conversas">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="ast-skeleton h-14 rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}

        {!loading && error && conversations.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-gray-050 px-3 py-3 text-center">
            <p className="text-xs text-gray-500">{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 text-xs font-semibold text-blue-800 hover:underline">
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && conversations.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-gray-400">Nenhuma conversa encontrada.</p>
        )}

        {groups.map(([label, items]) => (
          <div key={label}>
            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
            <div className="space-y-1">
              {items.map((c, idx) => {
                const isActive = c.id === activeId;
                const isPending = pendingIds.has(c.id);
                const confirming = confirmDeleteId === c.id;
                return (
                  <div
                    key={c.id}
                    style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}
                    className={cn(
                      "ast-slide-in-left group relative flex items-start gap-1 rounded-2xl border px-3 py-2.5 transition-all duration-200",
                      isActive
                        ? "border-yellow-400 bg-yellow-050 shadow-[var(--shadow-sm)]"
                        : "border-transparent hover:border-gray-200 hover:bg-gray-050"
                    )}
                  >
                    {isActive && <span className="absolute left-0 top-3 h-6 w-1 rounded-r-full bg-yellow-500" aria-hidden />}
                    <button type="button" onClick={() => onSelect(c.id)} className="min-w-0 flex-1 text-left" title={c.title}>
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-blue-900">
                        {isPending && <span className="ast-dot h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-600" aria-label="Respondendo" />}
                        <span className="truncate">{c.title}</span>
                      </p>
                      {c.preview && <p className="mt-0.5 truncate text-xs text-gray-500">{c.preview}</p>}
                      {!c.isOwner && c.owner && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-050 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                          <Users className="h-2.5 w-2.5" />
                          Compartilhada por {c.owner.full_name.split(" ")[0]}
                        </span>
                      )}
                      {c.isOwner && c.members && c.members.length > 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-050 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                          <Users className="h-2.5 w-2.5" />
                          Compartilhada com {c.members.length} {c.members.length === 1 ? "pessoa" : "pessoas"}
                        </span>
                      )}
                    </button>

                    {c.isOwner && !confirming && (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => setShareMenuFor(shareMenuFor === c.id ? null : c.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-blue-900"
                          title="Compartilhar conversa"
                          aria-label="Compartilhar conversa"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(c.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-[color:var(--color-danger)]"
                          title="Excluir conversa"
                          aria-label="Excluir conversa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {confirming && (
                      <div className="ast-pop flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onDelete(c.id)}
                          className="rounded-full bg-[color:var(--color-danger)] px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110"
                        >
                          Excluir
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label="Cancelar exclusão"
                          className="rounded-full p-1 text-gray-400 hover:bg-white hover:text-blue-900"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {shareMenuFor === c.id && (
                      <ShareMenu
                        conversationId={c.id}
                        ownerId={c.user_id}
                        onClose={() => setShareMenuFor(null)}
                        onMembersChange={(members) => onMembersChange(c.id, members)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

function AssistenteContent() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Mensagens, histórico e pendências são guardados POR conversa: assim trocar
  // de conversa enquanto o Helpinho responde não mistura nem perde respostas.
  const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>({});
  const [historyByConv, setHistoryByConv] = useState<Record<string, HistoryState>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [errorsByConv, setErrorsByConv] = useState<Record<string, string>>({});
  const pendingRef = useRef<Set<string>>(new Set());
  const historyRequestedRef = useRef<Set<string>>(new Set());

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shareMenuFor, setShareMenuFor] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskTitle, setCreateTaskTitle] = useState("");
  const handoffDoneRef = useRef(false);
  const createTaskConvRef = useRef<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const messages = useMemo(() => (activeId ? messagesByConv[activeId] ?? [] : []), [activeId, messagesByConv]);
  const history: HistoryState | undefined = activeId ? historyByConv[activeId] : undefined;
  const activePending = activeId ? pendingIds.has(activeId) : false;
  const activeError = activeId ? errorsByConv[activeId] : undefined;
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const ready = history === "ready";
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  /* ---------- helpers de estado por conversa ---------- */

  const appendMessage = useCallback((conversationId: string, message: ChatMessage) => {
    setMessagesByConv((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), message] }));
  }, []);

  const setPending = useCallback((conversationId: string, value: boolean) => {
    if (value) pendingRef.current.add(conversationId);
    else pendingRef.current.delete(conversationId);
    setPendingIds(new Set(pendingRef.current));
  }, []);

  const registerNewConversation = useCallback((conversation: Conversation) => {
    historyRequestedRef.current.add(conversation.id);
    setMessagesByConv((prev) => ({ ...prev, [conversation.id]: [] }));
    setHistoryByConv((prev) => ({ ...prev, [conversation.id]: "ready" }));
  }, []);

  /* ---------- conversas ---------- */

  const createConversation = useCallback(async (): Promise<Conversation | null> => {
    try {
      const res = await fetch("/api/assistente/conversations", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.conversation) throw new Error(data?.error || "Erro ao criar conversa");
      return { isOwner: true, members: [], ...data.conversation } as Conversation;
    } catch {
      setListError("Não foi possível iniciar uma nova conversa.");
      return null;
    }
  }, []);

  const loadConversations = useCallback(
    async (cancelledRef?: { current: boolean }) => {
      setLoadingConversations(true);
      setListError(null);
      try {
        const res = await fetch("/api/assistente/conversations");
        const data = await res.json().catch(() => null);
        if (cancelledRef?.current) return;

        if (!res.ok || !Array.isArray(data?.conversations)) {
          // Falhou: mostra erro com retry em vez de criar uma conversa em
          // branco que esconderia o histórico real.
          setListError(data?.error || "Não foi possível carregar suas conversas. Tente novamente.");
          return;
        }

        if (data.conversations.length > 0) {
          setConversations(data.conversations);
          const requestedId = searchParams.get("conversationId");
          const requested = requestedId && data.conversations.find((c: Conversation) => c.id === requestedId);
          setActiveId(requested ? requested.id : data.conversations[0].id);
        } else {
          const created = await createConversation();
          if (created && !cancelledRef?.current) {
            registerNewConversation(created);
            setConversations([created]);
            setActiveId(created.id);
          }
        }
      } catch {
        if (!cancelledRef?.current) setListError("Não foi possível carregar suas conversas. Tente novamente.");
      } finally {
        if (!cancelledRef?.current) setLoadingConversations(false);
      }
    },
    [createConversation, registerNewConversation, searchParams]
  );

  useEffect(() => {
    const cancelledRef = { current: false };
    loadConversations(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
    // carrega só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHistory = useCallback(async (conversationId: string) => {
    historyRequestedRef.current.add(conversationId);
    setHistoryByConv((prev) => ({ ...prev, [conversationId]: "loading" }));
    try {
      const res = await fetch(`/api/assistente?conversationId=${encodeURIComponent(conversationId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.messages)) throw new Error("history");
      setMessagesByConv((prev) => ({ ...prev, [conversationId]: data.messages }));
      setHistoryByConv((prev) => ({ ...prev, [conversationId]: "ready" }));
    } catch {
      historyRequestedRef.current.delete(conversationId);
      setHistoryByConv((prev) => ({ ...prev, [conversationId]: "error" }));
    }
  }, []);

  useEffect(() => {
    if (!activeId || historyRequestedRef.current.has(activeId)) return;
    loadHistory(activeId);
  }, [activeId, loadHistory]);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    setDrawerOpen(false);
    setConfirmDeleteId(null);
    setShareMenuFor(null);
    stickRef.current = true;
  }, []);

  async function handleNewConversation() {
    const created = await createConversation();
    if (!created) return;
    registerNewConversation(created);
    setConversations((prev) => [created, ...prev]);
    setListError(null);
    selectConversation(created.id);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleDeleteConversation(id: string) {
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/assistente/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao excluir conversa");
      }
    } catch (err) {
      setErrorsByConv((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : "Erro ao excluir conversa" }));
      return;
    }

    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    setMessagesByConv((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    historyRequestedRef.current.delete(id);

    if (activeId !== id) return;

    if (remaining.length > 0) {
      selectConversation(remaining[0].id);
    } else {
      const created = await createConversation();
      if (created) {
        registerNewConversation(created);
        setConversations([created]);
        selectConversation(created.id);
      } else {
        setActiveId(null);
      }
    }
  }

  /* ---------- vindo do Teleprompter ---------- */

  // O Teleprompter guarda o texto/roteiro no sessionStorage e navega pra cá:
  // abrimos uma conversa nova e deixamos a mensagem pronta no campo.
  useEffect(() => {
    if (handoffDoneRef.current || !ready) return;
    handoffDoneRef.current = true;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(HANDOFF_KEY);
      window.sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const { prompt } = JSON.parse(raw) as { prompt?: string };
      if (!prompt) return;
      void (async () => {
        await handleNewConversation();
        setInput(prompt);
      })();
    } catch {
      // payload inválido: ignora
    }
    // roda uma única vez, quando o histórico da primeira conversa fica pronto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* ---------- envio ---------- */

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      const conversationId = activeId;
      if (!content || !conversationId) return;
      if (historyByConv[conversationId] !== "ready" || pendingRef.current.has(conversationId)) return;

      const author = profile ? { full_name: profile.full_name } : null;
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        author,
        created_at: new Date().toISOString(),
      };

      setErrorsByConv((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setInput("");
      stickRef.current = true;

      const createTitle = detectCreateTaskIntent(content);
      if (createTitle !== null) {
        appendMessage(conversationId, userMessage);
        appendMessage(conversationId, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Claro! Abri o formulário de nova tarefa pra você preencher os detalhes.",
          created_at: new Date().toISOString(),
          fresh: true,
        });
        createTaskConvRef.current = conversationId;
        setCreateTaskTitle(createTitle);
        setCreateTaskOpen(true);
        return;
      }

      appendMessage(conversationId, userMessage);
      setPending(conversationId, true);

      try {
        const res = await fetch("/api/assistente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, conversationId }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || typeof data?.reply !== "string") {
          throw new Error(
            data?.error ||
              (res.status === 504 || res.status === 408
                ? "A consulta demorou demais. Tente uma pergunta mais específica."
                : "Erro ao falar com o assistente")
          );
        }
        const reply: string = data.reply;
        appendMessage(conversationId, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply,
          created_at: new Date().toISOString(),
          fresh: true,
        });
        setConversations((prev) => {
          const current = prev.find((c) => c.id === conversationId);
          if (!current) return prev;
          const updated: Conversation = {
            ...current,
            title: current.title === "Nova conversa" ? truncate(content) : current.title,
            preview: truncate(reply),
            updated_at: new Date().toISOString(),
          };
          return [updated, ...prev.filter((c) => c.id !== conversationId)];
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao falar com o assistente";
        setMessagesByConv((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((m) => (m.id === userMessage.id ? { ...m, failed: true } : m)),
        }));
        setErrorsByConv((prev) => ({ ...prev, [conversationId]: message }));
      } finally {
        setPending(conversationId, false);
      }
    },
    [activeId, appendMessage, historyByConv, profile, setPending]
  );

  const retry = useCallback(
    (failed: ChatMessage) => {
      if (!activeId) return;
      setMessagesByConv((prev) => ({
        ...prev,
        [activeId]: (prev[activeId] ?? []).filter((m) => m.id !== failed.id),
      }));
      // `send` lê o histórico do estado; defere um tick para ver a lista já limpa
      window.setTimeout(() => send(failed.content), 0);
    },
    [activeId, send]
  );

  /* ---------- scroll ---------- */

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distance < 120;
    setShowJump(distance > 240);
  }

  // Troca de conversa / histórico carregado: vai direto pro fim, sem animar.
  useLayoutEffect(() => {
    if (!ready) return;
    // conversa vazia: mostra a tela de boas-vindas desde o topo
    if (scrollRef.current && (messagesByConv[activeId ?? ""] ?? []).length === 0) scrollRef.current.scrollTo({ top: 0, behavior: "instant" });
    else scrollToBottom(false);
    // só ao trocar de conversa / terminar de carregar o histórico
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, ready, scrollToBottom]);

  // Mensagem nova ou "pensando…": acompanha o fim só se o usuário já estava lá.
  useEffect(() => {
    if (stickRef.current && messages.length > 0) scrollToBottom(true);
  }, [messages.length, activePending, activeError, scrollToBottom]);

  /* ---------- composer ---------- */

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    if (ready && !activePending) inputRef.current?.focus({ preventScroll: true });
  }, [ready, activePending, activeId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  const canSend = ready && !activePending && input.trim().length > 0;

  /* ---------- listas com separador de dia ---------- */

  const timeline = useMemo(() => {
    const rows: Array<{ type: "day"; key: string; label: string } | { type: "msg"; key: string; message: ChatMessage }> = [];
    let lastDay = "";
    for (const m of messages) {
      if (m.created_at) {
        const day = format(new Date(m.created_at), "yyyy-MM-dd");
        if (day !== lastDay) {
          rows.push({ type: "day", key: `day-${day}`, label: dayLabel(m.created_at) });
          lastDay = day;
        }
      }
      rows.push({ type: "msg", key: m.id, message: m });
    }
    return rows;
  }, [messages]);

  const listProps: ConversationListProps = {
    conversations,
    activeId,
    loading: loadingConversations,
    error: listError,
    pendingIds,
    query,
    setQuery,
    confirmDeleteId,
    setConfirmDeleteId,
    shareMenuFor,
    setShareMenuFor,
    onSelect: selectConversation,
    onNew: handleNewConversation,
    onDelete: handleDeleteConversation,
    onRetry: () => loadConversations(),
    onMembersChange: (conversationId, members) =>
      setConversations((prev) => prev.map((x) => (x.id === conversationId ? { ...x, members } : x))),
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Helpinho"
        description="Pergunte sobre tarefas, Instagram, tráfego pago, leads e metas — ou peça ajuda para criar conteúdo."
        action={
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              activePending ? "border-yellow-400 bg-yellow-050 text-blue-900" : "border-gray-200 bg-white text-gray-500"
            )}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-60",
                  activePending ? "ast-ring bg-yellow-600" : "ast-ring bg-[color:var(--color-success)]"
                )}
              />
              <span
                className={cn("relative inline-flex h-2 w-2 rounded-full", activePending ? "bg-yellow-600" : "bg-[color:var(--color-success)]")}
              />
            </span>
            {activePending ? "Helpinho está pensando…" : "Helpinho online"}
          </span>
        }
      />

      <div className="relative flex h-[calc(100dvh-220px)] min-h-[460px] gap-4">
        {/* Sidebar (desktop) */}
        <Card className="hidden w-72 shrink-0 flex-col overflow-hidden p-0 sm:flex">
          <ConversationList {...listProps} />
        </Card>

        {/* Sidebar (mobile: gaveta) */}
        {drawerOpen && (
          <div className="absolute inset-0 z-30 sm:hidden">
            <button
              type="button"
              aria-label="Fechar lista de conversas"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-blue-900/40 backdrop-blur-[1px]"
              style={{ animation: "overlay-fade-in 180ms ease-out both" }}
            />
            <Card className="ast-slide-in-left absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col overflow-hidden p-0 shadow-[var(--shadow-lg)]">
              <ConversationList {...listProps} />
            </Card>
          </div>
        )}

        {/* Chat */}
        <Card className="relative flex min-w-0 flex-1 flex-col overflow-hidden p-0">
          {/* Cabeçalho da conversa */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir lista de conversas"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-900 hover:bg-blue-050 sm:hidden"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <HelpinhoAvatar size="md" live={activePending} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold text-blue-900">{activeConversation?.title ?? "Helpinho"}</p>
              <p className="truncate text-xs text-gray-500">
                {activeConversation && !activeConversation.isOwner && activeConversation.owner
                  ? `Conversa de ${activeConversation.owner.full_name}`
                  : "Assistente de marketing da Help Multas"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleNewConversation}
              aria-label="Nova conversa"
              title="Nova conversa"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-900 hover:bg-blue-050 sm:hidden"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Mensagens */}
          <div className="relative min-h-0 flex-1">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              role="log"
              aria-live="polite"
              aria-label="Mensagens da conversa"
              className="h-full space-y-4 overflow-y-auto scroll-smooth p-4 sm:p-5"
            >
              {history === "loading" && <HistorySkeleton />}

              {history === "error" && (
                <div className="ast-fade-up flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-gray-500">Não foi possível carregar o histórico desta conversa.</p>
                  <button
                    type="button"
                    onClick={() => activeId && loadHistory(activeId)}
                    className="inline-flex items-center gap-1.5 rounded-full border-2 border-blue-900 px-4 py-1.5 font-display text-xs font-semibold text-blue-900 hover:bg-blue-050"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Tentar novamente
                  </button>
                </div>
              )}

              {!activeId && !loadingConversations && history === undefined && (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  {listError ?? "Crie uma conversa para começar."}
                </div>
              )}

              {ready && messages.length === 0 && (
                <div className="flex min-h-full flex-col items-center justify-center gap-6 py-4 text-center">
                  <div className="ast-fade-up">
                    <div className="ast-float relative mx-auto flex h-20 w-20 items-center justify-center">
                      <span className="ast-ring absolute inset-0 rounded-full bg-yellow-500/40" aria-hidden />
                      <span className="ast-ring absolute inset-0 rounded-full bg-yellow-500/30" style={{ animationDelay: "1.2s" }} aria-hidden />
                      <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-900 shadow-[var(--shadow-md)]">
                        <Bot className="h-9 w-9 text-yellow-500" />
                      </span>
                    </div>
                  </div>
                  <div className="ast-fade-up" style={{ animationDelay: "90ms" }}>
                    <p className="font-display text-xl font-bold text-blue-900">
                      {greeting()}
                      {firstName ? `, ${firstName}` : ""}! Eu sou o Helpinho
                    </p>
                    <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-500">
                      Tenho acesso aos dados do Hub: tarefas, Instagram, tráfego pago, leads, criativos e metas. Escolha uma sugestão ou
                      pergunte o que quiser.
                    </p>
                  </div>
                  <div className="grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {SUGESTOES.map((s, i) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.prompt}
                          type="button"
                          onClick={() => send(s.prompt)}
                          style={{ animationDelay: `${180 + i * 70}ms` }}
                          className="ast-fade-up group flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-yellow-400 hover:bg-yellow-050 hover:shadow-[var(--shadow-md)] active:translate-y-0"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-050 text-blue-800 transition-colors group-hover:bg-yellow-500 group-hover:text-blue-900">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-400">{s.label}</span>
                            <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-blue-900">{s.prompt}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {timeline.map((row) =>
                row.type === "day" ? (
                  <div key={row.key} className="flex items-center gap-3 py-1" aria-hidden>
                    <span className="h-px flex-1 bg-gray-100" />
                    <span className="rounded-full bg-gray-050 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {row.label}
                    </span>
                    <span className="h-px flex-1 bg-gray-100" />
                  </div>
                ) : (
                  <MessageBubble
                    key={row.key}
                    message={row.message}
                    isOwn={!row.message.author?.full_name || row.message.author.full_name === profile?.full_name}
                    profileName={profile?.full_name ?? ""}
                    profileAvatar={profile?.avatar_url ?? null}
                    onRetry={retry}
                  />
                )
              )}

              {activePending && <ThinkingBubble />}

              {activeError && !activePending && (
                <p className="ast-pop mx-auto w-fit max-w-full rounded-full bg-[color:var(--color-danger-bg)] px-4 py-1.5 text-center text-xs font-semibold text-[color:var(--color-danger)]">
                  {activeError}
                </p>
              )}
            </div>

            {showJump && (
              <button
                type="button"
                onClick={() => {
                  stickRef.current = true;
                  scrollToBottom(true);
                }}
                aria-label="Ir para a última mensagem"
                className="ast-pop absolute bottom-3 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-blue-900 shadow-[var(--shadow-md)] hover:bg-blue-050"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend) send(input);
            }}
            className="border-t border-gray-100 p-3"
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-3xl border bg-white transition-all duration-200",
                "focus-within:border-blue-900 focus-within:shadow-[var(--shadow-focus)]",
                activePending ? "border-yellow-400" : "border-gray-200"
              )}
            >
              {activePending && <span className="ast-gradient-bar absolute inset-x-0 top-0 h-0.5" aria-hidden />}
              <div className="flex items-end gap-2 p-2 pl-4">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  maxLength={4000}
                  placeholder={
                    ready ? "Pergunte sobre tarefas, Instagram, anúncios, leads…" : history === "error" ? "Histórico indisponível" : "Carregando conversa…"
                  }
                  disabled={!activeId || history === "loading" || history === "error"}
                  aria-label="Mensagem para o Helpinho"
                  className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm text-blue-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Enviar mensagem"
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                    canSend
                      ? "bg-yellow-500 text-blue-900 shadow-sm hover:scale-105 hover:bg-yellow-600 active:scale-95"
                      : "bg-gray-100 text-gray-300"
                  )}
                >
                  {activePending ? <Sparkles className="ast-pop h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="mt-1.5 px-2 text-[10px] text-gray-400">
              <kbd className="font-sans font-semibold">Enter</kbd> envia · <kbd className="font-sans font-semibold">Shift + Enter</kbd> quebra a linha ·
              O Helpinho pode errar; confira números importantes.
            </p>
          </form>
        </Card>
      </div>

      <CreateTaskModal
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        defaultTitle={createTaskTitle}
        onCreated={() => {
          setCreateTaskOpen(false);
          const target = createTaskConvRef.current;
          if (!target) return;
          appendMessage(target, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Tarefa criada com sucesso! Precisa de mais alguma coisa?",
            created_at: new Date().toISOString(),
            fresh: true,
          });
        }}
      />
    </div>
  );
}
