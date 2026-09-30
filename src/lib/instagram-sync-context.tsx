"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SyncCompletion } from "@/components/shared/SyncWidgets";

// Mesmo desenho de meta-sync-context: o estado vive num Provider montado em
// app/layout.tsx, então o card de progresso (canto inferior direito) e o
// popup de conclusão continuam aparecendo se a pessoa trocar de página
// enquanto o sync roda. O progresso em texto vem de instagram_sync_runs via
// Realtime.
type SyncState = "idle" | "running";

interface SyncResult {
  account: string;
  ok: boolean;
  days?: number;
  media?: number;
  error?: string;
  warnings?: string[];
}

interface SyncResponse {
  ok?: boolean;
  results?: SyncResult[];
  error?: string;
}

class SyncHttpError extends Error {
  constructor(public status: number, public statusText: string, public body: string) {
    super(`HTTP ${status}`);
  }
}

function describeSyncError(err: unknown): { message: string; technical: string } {
  if (err instanceof SyncHttpError) {
    let parsed: SyncResponse | null = null;
    try {
      parsed = JSON.parse(err.body);
    } catch {}

    const technical = [
      `HTTP ${err.status}${err.statusText ? ` ${err.statusText}` : ""} — POST /api/instagram/sync`,
      err.body ? `Resposta do servidor:\n${err.body.slice(0, 1500)}` : "Resposta do servidor vazia.",
    ].join("\n\n");

    if (err.status === 504 || err.status === 408) {
      return {
        message:
          "A sincronização demorou mais do que o servidor permite e foi interrompida. Tente novamente em alguns instantes.",
        technical,
      };
    }
    if (err.status === 401) {
      return { message: "Sua sessão expirou. Atualize a página, entre novamente e tente de novo.", technical };
    }
    const failed = (parsed?.results ?? []).filter((r) => !r.ok);
    if (failed.length) {
      return {
        message: failed.map((r) => `${r.account}: ${r.error}`).join("\n"),
        technical,
      };
    }
    return { message: "O servidor encontrou um problema durante a sincronização. Tente novamente.", technical };
  }
  if (err instanceof TypeError) {
    return {
      message: "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.",
      technical: `${err.name}: ${err.message}`,
    };
  }
  return {
    message: "A sincronização falhou por um erro inesperado. Tente novamente.",
    technical: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
  };
}

function summarize(results: SyncResult[]) {
  return results
    .map((r) => `${r.account}: ${r.days ?? 0} dias de métricas e ${r.media ?? 0} publicações.`)
    .join("\n");
}

interface InstagramSyncContextValue {
  state: SyncState;
  message: string;
  completion: SyncCompletion | null;
  dismissCompletion: () => void;
  triggerSync: () => void;
}

const InstagramSyncContext = createContext<InstagramSyncContextValue | null>(null);

export function InstagramSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState("");
  const [completion, setCompletion] = useState<SyncCompletion | null>(null);
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
      .channel(`instagram-sync-progress-${Date.now()}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "instagram_sync_runs" },
        (payload: { new?: { progress_message: string | null } }) => {
          if (payload.new?.progress_message) setMessage(payload.new.progress_message);
        }
      )
      .subscribe();

    fetch("/api/instagram/sync", { method: "POST" })
      .then(async (res) => {
        const body = await res.text();
        let json: SyncResponse | null = null;
        try {
          json = JSON.parse(body);
        } catch {}
        if (!res.ok || !json?.ok) throw new SyncHttpError(res.status, res.statusText, body);
        setCompletion({
          type: "success",
          title: "Sincronização do Instagram concluída",
          message: summarize(json.results ?? []),
        });
        router.refresh();
      })
      .catch((err) => {
        const { message, technical } = describeSyncError(err);
        setCompletion({ type: "error", title: "Falha na sincronização do Instagram", message, technical });
      })
      .finally(() => {
        supabase.removeChannel(channel);
        runningRef.current = false;
        setState("idle");
        setMessage("");
      });
  }, [router]);

  return (
    <InstagramSyncContext.Provider value={{ state, message, completion, dismissCompletion, triggerSync }}>
      {children}
    </InstagramSyncContext.Provider>
  );
}

export function useInstagramSync() {
  const ctx = useContext(InstagramSyncContext);
  if (!ctx) throw new Error("useInstagramSync deve ser usado dentro de InstagramSyncProvider");
  return ctx;
}
