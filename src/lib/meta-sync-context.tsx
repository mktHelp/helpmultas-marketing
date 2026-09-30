"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Estado da sincronização do Tráfego Pago mora aqui (não dentro do botão
// nem dos widgets visuais) justamente pra sobreviver a navegação entre
// páginas do Hub: o Provider é montado uma vez em app/(app)/layout.tsx e
// continua vivo enquanto a pessoa troca de aba, então o fetch e a
// inscrição Realtime seguem rodando e os widgets globais (card de
// progresso + popup de conclusão, em SyncStatusWidgets) refletem isso
// não importa em qual página ela esteja.
type SyncState = "idle" | "running";

interface Completion {
  type: "success" | "error";
  title: string;
  message: string;
  // Só em erro: detalhe cru (status HTTP, corpo da resposta, exceção) pra
  // quem for investigar/repassar pra dev.
  technical?: string;
}

class SyncHttpError extends Error {
  constructor(public status: number, public statusText: string, public body: string) {
    super(`HTTP ${status}`);
  }
}

// Traduz a falha pra uma frase que o usuário entende + guarda o detalhe
// técnico completo. O 504 é o caso clássico: a Vercel corta a função e
// devolve HTML/texto puro, o que quebrava o res.json() com "Unexpected token".
function describeSyncError(err: unknown): { message: string; technical: string } {
  if (err instanceof SyncHttpError) {
    const technical = [
      `HTTP ${err.status}${err.statusText ? ` ${err.statusText}` : ""} — POST /api/meta-ads/sync`,
      err.body ? `Resposta do servidor:\n${err.body.slice(0, 1500)}` : "Resposta do servidor vazia.",
    ].join("\n\n");

    let apiError = "";
    try {
      apiError = (JSON.parse(err.body) as { error?: string }).error ?? "";
    } catch {}

    if (err.status === 504 || err.status === 408) {
      return {
        message:
          "A sincronização demorou mais do que o servidor permite e foi interrompida. Tente novamente em alguns instantes; se acontecer de novo, avise o time de tecnologia.",
        technical,
      };
    }
    if (err.status === 401) {
      return { message: "Sua sessão expirou. Atualize a página, entre novamente e tente sincronizar de novo.", technical };
    }
    if (err.status === 403) {
      return { message: "Seu usuário não tem permissão para sincronizar os dados da Meta.", technical };
    }
    if (/Meta API|access token|OAuth|token/i.test(apiError)) {
      return {
        message:
          "Não foi possível acessar a conta de anúncios da Meta. O acesso (token) pode ter expirado ou perdido permissão. Avise o time de tecnologia.",
        technical,
      };
    }
    if (apiError.includes("não configurado")) {
      return { message: "A integração com a Meta não está totalmente configurada no servidor.", technical };
    }
    return {
      message: apiError
        ? "O servidor encontrou um problema durante a sincronização. Tente novamente; se persistir, envie o detalhe técnico abaixo ao time de tecnologia."
        : "A sincronização falhou por um erro inesperado do servidor. Tente novamente em instantes.",
      technical,
    };
  }

  if (err instanceof TypeError) {
    return {
      message: "Não foi possível falar com o servidor. Verifique sua conexão com a internet e tente novamente.",
      technical: `${err.name}: ${err.message}`,
    };
  }
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return { message: "A sincronização falhou por um erro inesperado. Tente novamente.", technical: raw };
}

interface SyncRunRow {
  progress_message: string | null;
}

interface MetaSyncContextValue {
  state: SyncState;
  message: string;
  completion: Completion | null;
  dismissCompletion: () => void;
  triggerSync: () => void;
}

const MetaSyncContext = createContext<MetaSyncContextValue | null>(null);

function summarize(entities: Record<string, number>) {
  const base = `${entities.campaigns ?? 0} campanhas, ${entities.adsets ?? 0} conjuntos, ${entities.ads ?? 0} anúncios, ${entities.matched_creatives ?? 0} criativos vinculados`;
  const leads = entities.rematched_leads ? `, ${entities.rematched_leads} leads vinculados a anúncios` : "";
  return `${base}${leads}.`;
}

export function MetaSyncProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState("");
  const [completion, setCompletion] = useState<Completion | null>(null);
  const runningRef = useRef(false);

  const dismissCompletion = useCallback(() => setCompletion(null), []);

  const triggerSync = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setCompletion(null);
    setState("running");
    setMessage("Iniciando sincronização...");

    const supabase = createClient();
    const channel = supabase
      .channel(`meta-sync-progress-${Date.now()}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "meta_sync_runs" },
        (payload: { new?: SyncRunRow }) => {
          if (payload.new?.progress_message) setMessage(payload.new.progress_message);
        }
      )
      .subscribe();

    fetch("/api/meta-ads/sync", { method: "POST" })
      .then(async (res) => {
        const body = await res.text();
        let json: { ok?: boolean; entities?: Record<string, number> } | null = null;
        try {
          json = JSON.parse(body);
        } catch {}
        if (!res.ok || !json?.ok) throw new SyncHttpError(res.status, res.statusText, body);
        setCompletion({
          type: "success",
          title: "Sincronização concluída",
          message: summarize(json.entities ?? {}),
        });
      })
      .catch((err) => {
        const { message, technical } = describeSyncError(err);
        setCompletion({ type: "error", title: "Falha na sincronização", message, technical });
      })
      .finally(() => {
        supabase.removeChannel(channel);
        runningRef.current = false;
        setState("idle");
        setMessage("");
      });
  }, []);

  return (
    <MetaSyncContext.Provider value={{ state, message, completion, dismissCompletion, triggerSync }}>
      {children}
    </MetaSyncContext.Provider>
  );
}

export function useMetaSync() {
  const ctx = useContext(MetaSyncContext);
  if (!ctx) throw new Error("useMetaSync deve ser usado dentro de MetaSyncProvider");
  return ctx;
}
