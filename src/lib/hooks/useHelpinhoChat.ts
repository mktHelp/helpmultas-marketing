"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { broadcastHelpinho, subscribeHelpinho } from "@/lib/helpinho-sync";

// Estado do chat do Helpinho para o botão flutuante (mesmas rotas da página
// /assistente). Só carrega depois que o painel é aberto pela primeira vez.

export interface WidgetMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  author?: { full_name: string; avatar_url?: string | null } | null;
  fresh?: boolean;
  failed?: boolean;
}

export interface WidgetConversation {
  id: string;
  title: string;
  preview: string;
  updated_at: string;
  user_id: string;
  isOwner: boolean;
  owner?: { full_name: string; avatar_url: string | null } | null;
}

type HistoryState = "loading" | "ready" | "error";

const ACTIVE_KEY = "hm-widget-conv";

function truncate(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(ACTIVE_KEY, id);
    else window.sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    // sem sessionStorage: segue sem lembrar a conversa
  }
}

export function useHelpinhoChat(enabled: boolean) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<WidgetConversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, WidgetMessage[]>>({});
  const [historyByConv, setHistoryByConv] = useState<Record<string, HistoryState>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [errorsByConv, setErrorsByConv] = useState<Record<string, string>>({});
  const pendingRef = useRef<Set<string>>(new Set());
  const remotePendingRef = useRef<Set<string>>(new Set());
  const historyRequestedRef = useRef<Set<string>>(new Set());
  const listLoadedRef = useRef(false);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    writeStored(id);
  }, []);

  const appendMessage = useCallback((conversationId: string, message: WidgetMessage) => {
    setMessagesByConv((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), message] }));
  }, []);

  const setPending = useCallback((conversationId: string, value: boolean) => {
    if (value) pendingRef.current.add(conversationId);
    else pendingRef.current.delete(conversationId);
    setPendingIds(new Set(pendingRef.current));
  }, []);

  const registerNew = useCallback((conversation: WidgetConversation) => {
    historyRequestedRef.current.add(conversation.id);
    setMessagesByConv((prev) => ({ ...prev, [conversation.id]: [] }));
    setHistoryByConv((prev) => ({ ...prev, [conversation.id]: "ready" }));
  }, []);

  const createConversation = useCallback(async (): Promise<WidgetConversation | null> => {
    try {
      const res = await fetch("/api/assistente/conversations", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.conversation) throw new Error(data?.error || "Erro ao criar conversa");
      return { isOwner: true, ...data.conversation } as WidgetConversation;
    } catch {
      setListError("Não foi possível iniciar uma nova conversa.");
      return null;
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch("/api/assistente/conversations");
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.conversations)) {
        setListError(data?.error || "Não foi possível carregar suas conversas.");
        return;
      }
      const list = data.conversations as WidgetConversation[];
      setConversations(list);
      const stored = readStored();
      const keep = stored && list.find((c) => c.id === stored);
      setActiveIdState(keep ? keep.id : list[0]?.id ?? null);
      listLoadedRef.current = true;
    } catch {
      setListError("Não foi possível carregar suas conversas.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !listLoadedRef.current) void loadConversations();
  }, [enabled, loadConversations]);

  const loadHistory = useCallback(async (conversationId: string, silent = false) => {
    historyRequestedRef.current.add(conversationId);
    if (!silent) setHistoryByConv((prev) => ({ ...prev, [conversationId]: "loading" }));
    try {
      const res = await fetch(`/api/assistente?conversationId=${encodeURIComponent(conversationId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.messages)) throw new Error("history");
      setMessagesByConv((prev) => ({ ...prev, [conversationId]: data.messages }));
      setHistoryByConv((prev) => ({ ...prev, [conversationId]: "ready" }));
    } catch {
      if (silent) return;
      historyRequestedRef.current.delete(conversationId);
      setHistoryByConv((prev) => ({ ...prev, [conversationId]: "error" }));
    }
  }, []);

  // Mudanças feitas na página /assistente (ou em outra aba) chegam aqui.
  useEffect(() => {
    if (!enabled) return;
    return subscribeHelpinho(async (event) => {
      const cid = event.conversationId;
      if (event.type === "sending" && cid && event.message) {
        const msg = event.message;
        remotePendingRef.current.add(cid);
        setMessagesByConv((prev) =>
          prev[cid] && !prev[cid].some((m) => m.id === msg.id) ? { ...prev, [cid]: [...prev[cid], msg] } : prev
        );
        setPending(cid, true);
        return;
      }
      if (cid && remotePendingRef.current.delete(cid)) setPending(cid, false);
      if (event.type === "failed") {
        if (cid) void loadHistory(cid, true);
        return;
      }
      if (event.type === "deleted" && event.conversationId) {
        const id = event.conversationId;
        historyRequestedRef.current.delete(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        setActiveIdState((cur) => (cur === id ? null : cur));
        return;
      }
      try {
        const res = await fetch("/api/assistente/conversations");
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data?.conversations)) {
          const list = data.conversations as WidgetConversation[];
          setConversations(list);
          setActiveIdState((cur) => cur ?? list[0]?.id ?? null);
        }
      } catch {
        // mantém a lista atual
      }
      const id = event.conversationId;
      if (id && historyRequestedRef.current.has(id) && !pendingRef.current.has(id)) void loadHistory(id, true);
    });
  }, [enabled, loadHistory, setPending]);

  useEffect(() => {
    if (!enabled || !activeId || historyRequestedRef.current.has(activeId)) return;
    void loadHistory(activeId);
  }, [enabled, activeId, loadHistory]);

  const newConversation = useCallback(async () => {
    const created = await createConversation();
    if (!created) return null;
    registerNew(created);
    setConversations((prev) => [created, ...prev]);
    setActiveId(created.id);
    broadcastHelpinho({ type: "changed", conversationId: created.id });
    return created;
  }, [createConversation, registerNew, setActiveId]);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/assistente/conversations/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete");
      } catch {
        setErrorsByConv((prev) => ({ ...prev, [id]: "Não foi possível excluir a conversa." }));
        return false;
      }
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      historyRequestedRef.current.delete(id);
      setMessagesByConv((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activeId === id) setActiveId(remaining[0]?.id ?? null);
      broadcastHelpinho({ type: "deleted", conversationId: id });
      return true;
    },
    [conversations, activeId, setActiveId]
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) return;

      let conversationId = activeId;
      if (!conversationId) {
        const created = await newConversation();
        if (!created) return;
        conversationId = created.id;
      }
      if (pendingRef.current.has(conversationId)) return;
      if (historyByConv[conversationId] === "loading") return;

      const cid = conversationId;
      const userMessage: WidgetMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        author: profile ? { full_name: profile.full_name, avatar_url: profile.avatar_url } : null,
        created_at: new Date().toISOString(),
      };
      setErrorsByConv((prev) => {
        if (!prev[cid]) return prev;
        const next = { ...prev };
        delete next[cid];
        return next;
      });
      appendMessage(cid, userMessage);
      setPending(cid, true);
      broadcastHelpinho({ type: "sending", conversationId: cid, message: userMessage });

      try {
        const res = await fetch("/api/assistente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, conversationId: cid }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || typeof data?.reply !== "string") {
          throw new Error(
            data?.error ||
              (res.status === 504 || res.status === 408 ? "A consulta demorou demais. Tente uma pergunta mais específica." : "Erro ao falar com o Helpinho")
          );
        }
        const reply: string = data.reply;
        appendMessage(cid, { id: crypto.randomUUID(), role: "assistant", content: reply, created_at: new Date().toISOString(), fresh: true });
        setConversations((prev) => {
          const current = prev.find((c) => c.id === cid);
          if (!current) return prev;
          const updated: WidgetConversation = {
            ...current,
            title: current.title === "Nova conversa" ? truncate(content) : current.title,
            preview: truncate(reply),
            updated_at: new Date().toISOString(),
          };
          return [updated, ...prev.filter((c) => c.id !== cid)];
        });
        broadcastHelpinho({ type: "changed", conversationId: cid });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao falar com o Helpinho";
        setMessagesByConv((prev) => ({
          ...prev,
          [cid]: (prev[cid] ?? []).map((m) => (m.id === userMessage.id ? { ...m, failed: true } : m)),
        }));
        setErrorsByConv((prev) => ({ ...prev, [cid]: message }));
        broadcastHelpinho({ type: "failed", conversationId: cid });
      } finally {
        setPending(cid, false);
      }
    },
    [activeId, appendMessage, historyByConv, newConversation, profile, setPending]
  );

  const retry = useCallback(
    (failed: WidgetMessage) => {
      if (!activeId) return;
      setMessagesByConv((prev) => ({ ...prev, [activeId]: (prev[activeId] ?? []).filter((m) => m.id !== failed.id) }));
      window.setTimeout(() => void send(failed.content), 0);
    },
    [activeId, send]
  );

  /** Mensagens só locais (ex.: aviso de que o formulário de tarefa foi aberto). */
  const addLocalExchange = useCallback(
    async (userText: string, assistantText: string) => {
      let cid = activeId;
      if (!cid) {
        const created = await newConversation();
        if (!created) return;
        cid = created.id;
      }
      const now = new Date().toISOString();
      appendMessage(cid, { id: crypto.randomUUID(), role: "user", content: userText, created_at: now, author: profile ? { full_name: profile.full_name, avatar_url: profile.avatar_url } : null });
      appendMessage(cid, { id: crypto.randomUUID(), role: "assistant", content: assistantText, created_at: now, fresh: true });
    },
    [activeId, appendMessage, newConversation, profile]
  );

  const messages = useMemo(() => (activeId ? messagesByConv[activeId] ?? [] : []), [activeId, messagesByConv]);

  return {
    conversations,
    activeId,
    setActiveId,
    activeConversation: conversations.find((c) => c.id === activeId) ?? null,
    messages,
    history: activeId ? historyByConv[activeId] : undefined,
    pending: activeId ? pendingIds.has(activeId) : false,
    pendingIds,
    error: activeId ? errorsByConv[activeId] : undefined,
    loadingList,
    listError,
    reloadList: loadConversations,
    reloadHistory: loadHistory,
    newConversation,
    deleteConversation,
    send,
    retry,
    addLocalExchange,
  };
}

/** Mesma regra da página /assistente: pedidos de criar tarefa abrem o formulário. */
export function detectCreateTaskIntent(text: string): string | null {
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
