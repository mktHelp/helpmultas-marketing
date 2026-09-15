"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Plus, Send, Share2, Sparkles, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { ShareMenu } from "./ShareMenu";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  author?: { full_name: string } | null;
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

const SUGESTOES = [
  "Quais são as tarefas mais urgentes?",
  "O que vence essa semana?",
  "Me dá um rascunho de legenda para um reels sobre recurso de multa",
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

export default function AssistentePage() {
  return (
    <Suspense fallback={null}>
      <AssistenteContent />
    </Suspense>
  );
}

function AssistenteContent() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareMenuFor, setShareMenuFor] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskTitle, setCreateTaskTitle] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function loadConversations(cancelledRef?: { current: boolean }) {
    setLoadingConversations(true);
    setError(null);
    try {
      const res = await fetch("/api/assistente/conversations");
      const data = await res.json().catch(() => null);
      if (cancelledRef?.current) return;

      if (!res.ok || !Array.isArray(data?.conversations)) {
        // Fetch failed: show an error and let the user retry, instead of
        // silently spawning a blank conversation that hides real history.
        setError(data?.error || "Não foi possível carregar suas conversas. Tente novamente.");
        return;
      }

      if (data.conversations.length > 0) {
        setConversations(data.conversations);
        const requestedId = searchParams.get("conversationId");
        const requested = requestedId && data.conversations.find((c: Conversation) => c.id === requestedId);
        setActiveId(requested ? requested.id : data.conversations[0].id);
      } else {
        // Genuinely no conversations yet (new user) — start the first one.
        const created = await createConversation();
        if (created && !cancelledRef?.current) {
          setConversations([created]);
          setActiveId(created.id);
        }
      }
    } catch {
      setError("Não foi possível carregar suas conversas. Tente novamente.");
    } finally {
      if (!cancelledRef?.current) setLoadingConversations(false);
    }
  }

  useEffect(() => {
    const cancelledRef = { current: false };
    loadConversations(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingHistory(true);
    setMessages([]);
    async function loadMessages() {
      try {
        const res = await fetch(`/api/assistente?conversationId=${activeId}`);
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data?.messages)) {
          setMessages(data.messages);
        }
      } catch {
        // silencioso: histórico é um extra, não deve travar o chat
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }
    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  async function createConversation(): Promise<Conversation | null> {
    try {
      const res = await fetch("/api/assistente/conversations", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao criar conversa");
      return data.conversation;
    } catch {
      setError("Não foi possível iniciar uma nova conversa.");
      return null;
    }
  }

  async function handleNewConversation() {
    const created = await createConversation();
    if (!created) return;
    setConversations((prev) => [created, ...prev]);
    setActiveId(created.id);
    setError(null);
  }

  async function handleDeleteConversation(id: string) {
    if (!confirm("Excluir esta conversa? Essa ação não pode ser desfeita.")) return;

    try {
      const res = await fetch(`/api/assistente/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao excluir conversa");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir conversa");
      return;
    }

    let remaining: Conversation[] = [];
    setConversations((prev) => {
      remaining = prev.filter((c) => c.id !== id);
      return remaining;
    });

    if (activeId !== id) return;

    if (remaining.length > 0) {
      setActiveId(remaining[0].id);
    } else {
      const created = await createConversation();
      if (created) {
        setConversations([created]);
        setActiveId(created.id);
      } else {
        setActiveId(null);
      }
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending || !activeId) return;

    const createTitle = detectCreateTaskIntent(content);
    if (createTitle !== null) {
      setError(null);
      setInput("");
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content, author: profile ? { full_name: profile.full_name } : null },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Claro! Abri o formulário de nova tarefa pra você preencher os detalhes.",
        },
      ]);
      setCreateTaskTitle(createTitle);
      setCreateTaskOpen(true);
      return;
    }

    const conversationId = activeId;
    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content, author: profile ? { full_name: profile.full_name } : null },
    ]);
    setSending(true);

    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao falar com o assistente");
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.reply }]);
      const reply = data.reply as string;
      setConversations((prev) => {
        const current = prev.find((c) => c.id === conversationId);
        if (!current) return prev;
        const isFirstMessage = current.title === "Nova conversa";
        const updated: Conversation = {
          ...current,
          title: isFirstMessage ? (content.length > 60 ? `${content.slice(0, 60)}…` : content) : current.title,
          preview: reply.length > 60 ? `${reply.slice(0, 60)}…` : reply,
          updated_at: new Date().toISOString(),
        };
        return [updated, ...prev.filter((c) => c.id !== conversationId)];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao falar com o assistente");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Assistente"
        description="Pergunte sobre tarefas e prazos, ou peça ajuda para criar conteúdo. É o Helpinho, com ChatGPT."
      />

      <div className="flex h-[calc(100vh-220px)] min-h-[420px] gap-4">
        <Card className="hidden w-72 shrink-0 flex-col overflow-hidden p-0 sm:flex">
          <div className="p-3">
            <Button onClick={handleNewConversation} className="w-full justify-center" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Nova conversa
            </Button>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-3">
            {loadingConversations && <p className="px-2.5 py-1 text-xs text-gray-400">Carregando...</p>}
            {!loadingConversations && error && conversations.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-050 px-3 py-3 text-center">
                <p className="text-xs text-gray-500">{error}</p>
                <button
                  onClick={() => loadConversations()}
                  className="mt-2 text-xs font-semibold text-blue-800 hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {conversations.map((c) => {
              const isActive = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group relative flex items-start gap-1 rounded-2xl border px-3 py-2.5 transition-colors",
                    isActive ? "border-yellow-400 bg-yellow-050" : "border-transparent hover:border-gray-200 hover:bg-gray-050"
                  )}
                >
                  <button onClick={() => setActiveId(c.id)} className="min-w-0 flex-1 text-left" title={c.title}>
                    <p className={cn("truncate text-sm font-semibold", isActive ? "text-blue-900" : "text-blue-900/90")}>
                      {c.title}
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

                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {c.isOwner && (
                      <button
                        onClick={() => setShareMenuFor(shareMenuFor === c.id ? null : c.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-blue-900"
                        title="Compartilhar conversa"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {c.isOwner && (
                      <button
                        onClick={() => handleDeleteConversation(c.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-[color:var(--color-danger)]"
                        title="Excluir conversa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {shareMenuFor === c.id && (
                    <ShareMenu
                      conversationId={c.id}
                      ownerId={c.user_id}
                      onClose={() => setShareMenuFor(null)}
                      onMembersChange={(members) =>
                        setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, members } : x)))
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="flex flex-1 flex-col overflow-hidden p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && !loadingHistory && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-900">
                  <Bot className="h-7 w-7 text-yellow-500" />
                </span>
                <div>
                  <p className="font-display font-bold text-blue-900">Oi, eu sou o Helpinho!</p>
                  <p className="mt-1 max-w-sm text-sm text-gray-500">
                    Posso consultar suas tarefas ou ajudar a criar conteúdo. Experimenta perguntar:
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-050"
                    >
                      <Sparkles className="mr-1 inline h-3 w-3 text-yellow-500" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const authorName = m.role === "user" ? m.author?.full_name : null;
              const isOwnMessage = !authorName || authorName === profile?.full_name;
              return (
                <div key={m.id} className={cn("flex items-end gap-2.5", m.role === "user" && isOwnMessage && "flex-row-reverse")}>
                  {m.role === "assistant" ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-900">
                      <Bot className="h-4 w-4 text-yellow-500" />
                    </span>
                  ) : (
                    <UserAvatar name={authorName || profile?.full_name || "Você"} avatarUrl={isOwnMessage ? profile?.avatar_url : null} size="sm" />
                  )}
                  <div className={cn("flex max-w-[75%] flex-col", m.role === "user" && isOwnMessage && "items-end")}>
                    {m.role === "user" && authorName && !isOwnMessage && (
                      <span className="mb-0.5 px-1 text-[11px] font-semibold text-gray-400">{authorName}</span>
                    )}
                    <div
                      className={cn(
                        "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                        m.role === "user" ? "bg-yellow-500 text-blue-900" : "bg-gray-050 text-blue-900"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-end gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-900">
                  <Bot className="h-4 w-4 text-yellow-500" />
                </span>
                <div className="flex items-center gap-1 rounded-2xl bg-gray-050 px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                </div>
              </div>
            )}

            {error && <p className="text-center text-xs font-semibold text-[color:var(--color-danger)]">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-gray-200 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre tarefas ou peça um rascunho de conteúdo..."
              disabled={sending || !activeId}
              className="h-11 flex-1 rounded-full border border-gray-200 bg-white px-4 text-sm outline-none focus:border-blue-900"
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim() || !activeId}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>

      <CreateTaskModal
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        defaultTitle={createTaskTitle}
        onCreated={() => {
          setCreateTaskOpen(false);
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: "Tarefa criada com sucesso! Precisa de mais alguma coisa?" },
          ]);
        }}
      />
    </div>
  );
}
