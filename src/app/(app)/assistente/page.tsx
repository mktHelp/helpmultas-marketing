"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  preview: string;
  updated_at: string;
}

const SUGESTOES = [
  "Quais são as tarefas mais urgentes?",
  "O que vence essa semana?",
  "Me dá um rascunho de legenda para um reels sobre recurso de multa",
];

export default function AssistentePage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    let cancelled = false;
    async function loadConversations() {
      try {
        const res = await fetch("/api/assistente/conversations");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data?.conversations) && data.conversations.length > 0) {
          setConversations(data.conversations);
          setActiveId(data.conversations[0].id);
        } else {
          const created = await createConversation();
          if (created && !cancelled) {
            setConversations([created]);
            setActiveId(created.id);
          }
        }
      } catch {
        setError("Não foi possível carregar suas conversas.");
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    }
    loadConversations();
    return () => {
      cancelled = true;
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

    const conversationId = activeId;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content }]);
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
        <Card className="hidden w-64 shrink-0 flex-col overflow-hidden p-0 sm:flex">
          <div className="border-b border-gray-200 p-3">
            <Button onClick={handleNewConversation} className="w-full justify-center" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Nova conversa
            </Button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {loadingConversations && <p className="px-2 py-1 text-xs text-gray-400">Carregando...</p>}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-start gap-1 rounded-lg pl-3 pr-1.5 py-2",
                  c.id === activeId ? "bg-blue-900" : "hover:bg-blue-050"
                )}
              >
                <button onClick={() => setActiveId(c.id)} className="min-w-0 flex-1 text-left" title={c.title}>
                  <p className={cn("truncate text-sm font-medium", c.id === activeId ? "text-white" : "text-blue-900")}>
                    {c.title}
                  </p>
                  {c.preview && (
                    <p className={cn("mt-0.5 truncate text-xs", c.id === activeId ? "text-blue-200" : "text-gray-500")}>
                      {c.preview}
                    </p>
                  )}
                </button>
                <button
                  onClick={() => handleDeleteConversation(c.id)}
                  className={cn(
                    "mt-1 shrink-0 rounded p-1 opacity-0 group-hover:opacity-100",
                    c.id === activeId ? "text-blue-200 hover:text-white" : "text-gray-400 hover:text-[color:var(--color-danger)]"
                  )}
                  title="Excluir conversa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
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

            {messages.map((m) => (
              <div key={m.id} className={cn("flex items-end gap-2.5", m.role === "user" && "flex-row-reverse")}>
                {m.role === "assistant" ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-900">
                    <Bot className="h-4 w-4 text-yellow-500" />
                  </span>
                ) : (
                  <UserAvatar name={profile?.full_name || "Você"} avatarUrl={profile?.avatar_url} size="sm" />
                )}
                <div
                  className={cn(
                    "max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "user" ? "bg-yellow-500 text-blue-900" : "bg-gray-050 text-blue-900"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

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
    </div>
  );
}
