"use client";

// Sincroniza o chat flutuante do Helpinho com a página /assistente (e outras
// abas): quem muda algo avisa, quem recebe recarrega do servidor.

export interface HelpinhoSyncMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  author?: { full_name: string; avatar_url?: string | null } | null;
}

// "sending": mensagem enviada, resposta ainda em andamento (o servidor só salva
// depois da resposta, então a mensagem viaja no próprio aviso).
// "failed": o envio falhou; quem recebe tira o "pensando…".
export interface HelpinhoSyncEvent {
  type: "changed" | "deleted" | "sending" | "failed";
  conversationId?: string;
  message?: HelpinhoSyncMessage;
}

const CHANNEL = "helpinho-sync";

export function broadcastHelpinho(event: HelpinhoSyncEvent) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage(event);
  channel.close();
}

export function subscribeHelpinho(handler: (event: HelpinhoSyncEvent) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e: MessageEvent<HelpinhoSyncEvent>) => handler(e.data);
  return () => channel.close();
}
