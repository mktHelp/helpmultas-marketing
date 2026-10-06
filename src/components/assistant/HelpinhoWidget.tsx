"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, ChevronLeft, MessageSquare, Maximize2, Plus, RotateCcw, Send, Sparkles, Trash2, Users, X } from "lucide-react";
import { Markdown } from "@/components/assistant/Markdown";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { useAuth } from "@/lib/auth-context";
import { detectCreateTaskIntent, useHelpinhoChat, type WidgetMessage } from "@/lib/hooks/useHelpinhoChat";
import { cn } from "@/lib/utils";

// Botão flutuante do Helpinho em todas as páginas do Hub, exceto no próprio
// chat (/assistente) e no Teleprompter, que já têm o Helpinho integrado. O
// painel só fecha pelo X: nada de fechar ao clicar fora ou apertar Esc.

const HIDDEN_PREFIXES = ["/assistente", "/teleprompter", "/expansao/assistente"];
const OPEN_KEY = "hm-widget-open";
const GREETED_KEY = "hm-widget-greeted";
const POS_KEY = "hm-widget-bottom";
const DEFAULT_BOTTOM = 96;
const MIN_BOTTOM = 16;

function clampBottom(v: number) {
  const max = typeof window === "undefined" ? 800 : window.innerHeight - 96;
  return Math.min(Math.max(v, MIN_BOTTOM), Math.max(max, MIN_BOTTOM));
}

const SUGGESTIONS = [
  "Quais são as tarefas mais urgentes?",
  "Quanto gastamos em anúncios nos últimos 7 dias?",
  "Escreva um roteiro de 1 minuto sobre recurso de multa",
];

function ago(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });
  } catch {
    return "";
  }
}

function Bubble({ message, isOwn, onRetry }: { message: WidgetMessage; isOwn: boolean; onRetry: (m: WidgetMessage) => void }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("ast-msg-in flex items-end gap-2", isUser && isOwn && "flex-row-reverse")}>
      {isUser ? (
        <UserAvatar name={message.author?.full_name || "Você"} avatarUrl={message.author?.avatar_url ?? null} size="xs" />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-900">
          <Bot className="h-3.5 w-3.5 text-yellow-500" />
        </span>
      )}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col", isUser && isOwn && "items-end")}>
        <div
          className={cn(
            "min-w-0 max-w-full rounded-2xl px-3.5 py-2 text-sm",
            isUser ? "whitespace-pre-wrap break-words rounded-br-md bg-yellow-500 text-blue-900" : "rounded-bl-md bg-gray-050 text-blue-900",
            message.failed && "opacity-60"
          )}
        >
          {isUser ? message.content : <Markdown reveal={message.fresh}>{message.content}</Markdown>}
        </div>
        {message.failed && (
          <button
            type="button"
            onClick={() => onRetry(message)}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-danger-bg)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-danger)]"
          >
            <RotateCcw className="h-3 w-3" /> Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="ast-msg-in flex items-end gap-2" role="status" aria-label="O Helpinho está respondendo">
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-900">
        <span className="ast-ring absolute inset-0 rounded-full bg-yellow-500/50" aria-hidden />
        <Bot className="relative h-3.5 w-3.5 text-yellow-500" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-gray-050 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="ast-dot h-1.5 w-1.5 rounded-full bg-blue-700" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function HelpinhoWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  // Na área da Expansão o chat é o mesmo, mas sem criar tarefas (é do time interno).
  const isExpansion = pathname === "/expansao" || pathname.startsWith("/expansao/");
  const chatPath = isExpansion ? "/expansao/assistente" : "/assistente";
  const hidden = HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [view, setView] = useState<"chat" | "list">("chat");
  const [input, setInput] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskTitle, setCreateTaskTitle] = useState("");
  // distância do botão até a base da tela; dá para arrastar para cima/baixo e a posição fica salva
  const [bottom, setBottom] = useState(DEFAULT_BOTTOM);
  const dragRef = useRef<{ startY: number; startBottom: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);

  const chat = useHelpinhoChat(everOpened);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  // reabre se estava aberto antes de navegar/atualizar
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(OPEN_KEY) === "1") {
        setOpen(true);
        setEverOpened(true);
      }
    } catch {
      // ignora
    }
  }, []);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(POS_KEY));
      if (saved) setBottom(clampBottom(saved));
    } catch {
      // ignora
    }
    const onResize = () => setBottom((b) => clampBottom(b));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function savePosition(value: number) {
    try {
      window.localStorage.setItem(POS_KEY, String(Math.round(value)));
    } catch {
      // ignora
    }
  }

  // balão de boas-vindas, uma vez por sessão
  useEffect(() => {
    if (hidden) return;
    let greeted = false;
    try {
      greeted = window.sessionStorage.getItem(GREETED_KEY) === "1";
    } catch {
      // ignora
    }
    if (greeted) return;
    const show = window.setTimeout(() => setGreeting(true), 3500);
    const hide = window.setTimeout(() => {
      setGreeting(false);
      try {
        window.sessionStorage.setItem(GREETED_KEY, "1");
      } catch {
        // ignora
      }
    }, 11000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [hidden]);

  function openPanel() {
    setOpen(true);
    setEverOpened(true);
    setGreeting(false);
    try {
      window.sessionStorage.setItem(OPEN_KEY, "1");
      window.sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      // ignora
    }
  }

  function closePanel() {
    setOpen(false);
    try {
      window.sessionStorage.setItem(OPEN_KEY, "0");
    } catch {
      // ignora
    }
  }

  // rolagem acompanha o fim da conversa
  useEffect(() => {
    if (stickRef.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length, chat.pending, chat.error, view, open]);

  useEffect(() => {
    if (open && view === "chat" && chat.history === "ready") inputRef.current?.focus({ preventScroll: true });
  }, [open, view, chat.history, chat.activeId]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input, open, view]);

  if (hidden) return null;

  const canSend = input.trim().length > 0 && !chat.pending && chat.history !== "loading";

  async function submit(text: string) {
    const content = text.trim();
    if (!content) return;
    setInput("");
    stickRef.current = true;
    const intent = isExpansion ? null : detectCreateTaskIntent(content);
    if (intent !== null) {
      await chat.addLocalExchange(content, "Claro! Abri o formulário de nova tarefa pra você preencher os detalhes.");
      setCreateTaskTitle(intent);
      setCreateTaskOpen(true);
      return;
    }
    await chat.send(content);
  }

  async function startNew() {
    const created = await chat.newConversation();
    if (created) {
      setView("chat");
      setInput("");
      stickRef.current = true;
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <div className="fixed right-4 z-30 print:hidden sm:right-5" style={{ bottom, marginBottom: "env(safe-area-inset-bottom)" }}>
          {greeting && (
            <div className="hw-bubble-in absolute bottom-full right-0 mb-3 w-max max-w-[220px] rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-sm font-semibold text-blue-900 shadow-[var(--shadow-lg)] ring-1 ring-gray-200">
              Oi{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! Posso ajudar? 👋
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (justDraggedRef.current) {
                justDraggedRef.current = false;
                return;
              }
              openPanel();
            }}
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // alguns navegadores/toques não suportam captura
              }
              justDraggedRef.current = false;
              dragRef.current = { startY: e.clientY, startBottom: bottom, moved: false };
            }}
            onPointerMove={(e) => {
              const drag = dragRef.current;
              if (!drag) return;
              const dy = e.clientY - drag.startY;
              if (Math.abs(dy) > 6) drag.moved = true;
              if (drag.moved) setBottom(clampBottom(drag.startBottom - dy));
            }}
            onPointerUp={(e) => {
              const drag = dragRef.current;
              dragRef.current = null;
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                // ignora
              }
              if (drag?.moved) {
                justDraggedRef.current = true;
                setBottom((b) => {
                  savePosition(b);
                  return b;
                });
              }
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                setBottom((b) => {
                  const next = clampBottom(b + (e.key === "ArrowUp" ? 24 : -24));
                  savePosition(next);
                  return next;
                });
              }
            }}
            aria-label="Abrir o Helpinho"
            title="Conversar com o Helpinho (arraste para subir ou descer)"
            style={{ touchAction: "none" }}
            className="group relative flex h-16 w-16 cursor-grab touch-none select-none items-center justify-center rounded-full outline-none transition-transform duration-200 hover:scale-110 focus-visible:ring-4 focus-visible:ring-yellow-500/60 active:scale-95 active:cursor-grabbing"
          >
            <span className="ast-ring absolute inset-0 rounded-full bg-yellow-500/50" aria-hidden />
            <span className="ast-ring absolute inset-0 rounded-full bg-yellow-500/40" style={{ animationDelay: "1.2s" }} aria-hidden />
            <span className="ast-float relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-blue-900 shadow-lg shadow-blue-900/30 ring-2 ring-yellow-500">
              <Bot className="h-8 w-8 text-yellow-500 transition-transform duration-200 group-hover:rotate-6" />
            </span>
            <Sparkles className="sb-twinkle absolute -right-0.5 -top-0.5 h-5 w-5 text-yellow-400 drop-shadow" />
          </button>
        </div>
      )}

      {/* Painel */}
      {open && (
        <section
          role="dialog"
          aria-label="Conversa com o Helpinho"
          className="hw-pop-in print:hidden fixed inset-x-2 bottom-2 top-16 z-[45] flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[var(--shadow-lg)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px]"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Cabeçalho */}
          <header className="flex shrink-0 items-center gap-2 bg-gradient-to-r from-blue-900 to-blue-800 px-3 py-3 text-white">
            {view === "list" ? (
              <button type="button" onClick={() => setView("chat")} aria-label="Voltar à conversa" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <span className="relative ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500 text-blue-900">
                {chat.pending && <span className="ast-ring absolute inset-0 rounded-full bg-yellow-500/60" aria-hidden />}
                <Bot className="relative h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-display text-sm font-bold">{view === "list" ? "Conversas" : "Helpinho"}</p>
              <p className="truncate text-[11px] text-blue-100">
                {view === "list" ? `${chat.conversations.length} no total` : chat.pending ? "pensando…" : chat.activeConversation?.title ?? "Nova conversa"}
              </p>
            </div>
            {view === "chat" && (
              <button type="button" onClick={() => setView("list")} aria-label="Ver conversas" title="Conversas" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
                <MessageSquare className="h-[18px] w-[18px]" />
              </button>
            )}
            <button type="button" onClick={startNew} aria-label="Nova conversa" title="Nova conversa" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
              <Plus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => router.push(chat.activeId ? `${chatPath}?conversationId=${chat.activeId}` : chatPath)}
              aria-label="Abrir em tela cheia"
              title="Abrir em tela cheia"
              className="hidden h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 sm:flex"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={closePanel} aria-label="Fechar o Helpinho" title="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </header>

          {view === "list" ? (
            /* ---- Lista de conversas ---- */
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              <button
                type="button"
                onClick={startNew}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-yellow-500 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Nova conversa
              </button>

              {chat.loadingList && chat.conversations.length === 0 && [0, 1, 2].map((i) => <div key={i} className="ast-skeleton h-14 rounded-2xl" style={{ animationDelay: `${i * 100}ms` }} />)}
              {chat.listError && (
                <div className="rounded-2xl bg-gray-050 px-3 py-3 text-center text-xs text-gray-500">
                  {chat.listError}{" "}
                  <button type="button" onClick={() => void chat.reloadList()} className="font-semibold text-blue-800 hover:underline">
                    Tentar novamente
                  </button>
                </div>
              )}

              {chat.conversations.map((c, i) => {
                const active = c.id === chat.activeId;
                const confirming = confirmDeleteId === c.id;
                return (
                  <div
                    key={c.id}
                    style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                    className={cn(
                      "ast-slide-in-left group relative flex items-start gap-1 rounded-2xl border px-3 py-2.5 transition-all",
                      active ? "border-yellow-400 bg-yellow-050" : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        chat.setActiveId(c.id);
                        setView("chat");
                        stickRef.current = true;
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="flex items-center gap-1.5 truncate text-sm font-bold text-blue-900">
                        {chat.pendingIds.has(c.id) && <span className="ast-dot h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-600" aria-label="Respondendo" />}
                        <span className="truncate">{c.title}</span>
                      </p>
                      {c.preview && <p className="mt-0.5 truncate text-xs text-gray-500">{c.preview}</p>}
                      <p className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                        {ago(c.updated_at)}
                        {!c.isOwner && c.owner && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-050 px-1.5 py-0.5 text-blue-800">
                            <Users className="h-2.5 w-2.5" /> de {c.owner.full_name.split(" ")[0]}
                          </span>
                        )}
                      </p>
                    </button>
                    {c.isOwner && !confirming && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(c.id)}
                        aria-label="Excluir conversa"
                        className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-white hover:text-[color:var(--color-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {confirming && (
                      <div className="ast-pop flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            setConfirmDeleteId(null);
                            await chat.deleteConversation(c.id);
                          }}
                          className="rounded-full bg-[color:var(--color-danger)] px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          Excluir
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} aria-label="Cancelar" className="rounded-full p-1 text-gray-400 hover:bg-white">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {!chat.loadingList && !chat.listError && chat.conversations.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">Nenhuma conversa ainda. Comece uma nova!</p>
              )}
            </div>
          ) : (
            /* ---- Conversa ---- */
            <>
              <div
                ref={scrollRef}
                onScroll={() => {
                  const el = scrollRef.current;
                  if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                }}
                role="log"
                aria-live="polite"
                className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
              >
                {chat.loadingList && !chat.activeId && <div className="ast-skeleton h-16 rounded-2xl" />}
                {chat.history === "loading" && (
                  <div className="space-y-3" role="status" aria-label="Carregando conversa">
                    {[0, 1].map((i) => (
                      <div key={i} className={cn("flex items-end gap-2", i === 1 && "flex-row-reverse")}>
                        <span className="ast-skeleton h-6 w-6 rounded-full" />
                        <span className={cn("ast-skeleton h-12 rounded-2xl", i === 0 ? "w-3/5" : "w-2/5")} />
                      </div>
                    ))}
                  </div>
                )}
                {chat.history === "error" && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500">Não foi possível carregar esta conversa.</p>
                    <button
                      type="button"
                      onClick={() => chat.activeId && void chat.reloadHistory(chat.activeId)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-blue-900 px-4 py-1.5 text-xs font-semibold text-blue-900"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
                    </button>
                  </div>
                )}

                {(chat.history === "ready" || (!chat.activeId && !chat.loadingList)) && chat.messages.length === 0 && (
                  <div className="ast-fade-up flex flex-col items-center gap-3 py-4 text-center">
                    <span className="ast-float flex h-14 w-14 items-center justify-center rounded-full bg-blue-900 shadow-[var(--shadow-md)]">
                      <Bot className="h-7 w-7 text-yellow-500" />
                    </span>
                    <div>
                      <p className="font-display text-base font-bold text-blue-900">Oi{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!</p>
                      <p className="mt-0.5 text-xs text-gray-500">Pergunte sobre tarefas, Instagram, anúncios, leads ou peça um roteiro.</p>
                    </div>
                    <div className="flex w-full flex-col gap-1.5">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void submit(s)}
                          style={{ animationDelay: `${120 + i * 70}ms` }}
                          className="ast-fade-up rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-left text-[13px] font-semibold text-blue-900 transition-all hover:border-yellow-400 hover:bg-yellow-050 active:scale-[0.98]"
                        >
                          <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-yellow-500" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chat.messages.map((m) => (
                  <Bubble
                    key={m.id}
                    message={m}
                    isOwn={!m.author?.full_name || m.author.full_name === profile?.full_name}
                    onRetry={chat.retry}
                  />
                ))}
                {chat.pending && <Thinking />}
                {chat.error && !chat.pending && (
                  <p className="ast-pop mx-auto w-fit max-w-full rounded-full bg-[color:var(--color-danger-bg)] px-3.5 py-1.5 text-center text-xs font-semibold text-[color:var(--color-danger)]">
                    {chat.error}
                  </p>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSend) void submit(input);
                }}
                className="shrink-0 border-t border-gray-100 p-2.5"
              >
                <div className={cn("relative flex items-end gap-2 rounded-3xl border bg-white p-1.5 pl-3.5 transition-all focus-within:border-blue-900 focus-within:shadow-[var(--shadow-focus)]", chat.pending ? "border-yellow-400" : "border-gray-200")}>
                  {chat.pending && <span className="ast-gradient-bar absolute inset-x-4 top-0 h-0.5 rounded-full" aria-hidden />}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        if (canSend) void submit(input);
                      }
                    }}
                    rows={1}
                    maxLength={4000}
                    placeholder="Pergunte ao Helpinho…"
                    aria-label="Mensagem para o Helpinho"
                    className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-blue-900 outline-none placeholder:text-gray-400"
                    style={{ fontSize: 16 }}
                  />
                  <button
                    type="submit"
                    disabled={!canSend}
                    aria-label="Enviar mensagem"
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
                      canSend ? "bg-yellow-500 text-blue-900 shadow-sm hover:bg-yellow-600 active:scale-90" : "bg-gray-100 text-gray-300"
                    )}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      )}

      {!isExpansion && <CreateTaskModal open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} defaultTitle={createTaskTitle} onCreated={() => setCreateTaskOpen(false)} />}
    </>
  );
}
