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
  return `${entities.campaigns ?? 0} campanhas, ${entities.adsets ?? 0} conjuntos, ${entities.ads ?? 0} anúncios, ${entities.matched_creatives ?? 0} criativos vinculados.`;
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
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha na sincronização");
        setCompletion({
          type: "success",
          title: "Sincronização concluída",
          message: summarize(json.entities ?? {}),
        });
      })
      .catch((err) => {
        setCompletion({
          type: "error",
          title: "Falha na sincronização",
          message: err instanceof Error ? err.message : "Erro desconhecido",
        });
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
