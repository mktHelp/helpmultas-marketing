"use client";

import { useEffect } from "react";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useMetaSync } from "@/lib/meta-sync-context";

// Montado uma vez em app/(app)/layout.tsx (dentro do MetaSyncProvider), não
// dentro das páginas de Tráfego Pago — por isso funciona em qualquer tela
// do Hub, mesmo que a sincronização tenha começado em outra aba.

function SyncProgressCard() {
  const { state, message } = useMetaSync();
  if (state !== "running") return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-40 flex max-w-xs items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-lg)]"
      style={{ animation: "overlay-fade-in 0.2s ease-out" }}
    >
      <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-900" />
      <div>
        <p className="text-sm font-semibold text-blue-900">Sincronizando Tráfego Pago</p>
        <p className="mt-0.5 text-xs leading-snug text-gray-500">{message || "Processando..."}</p>
      </div>
    </div>
  );
}

function SyncCompletionOverlay() {
  const { completion, dismissCompletion } = useMetaSync();

  useEffect(() => {
    if (!completion) return;
    const timer = setTimeout(dismissCompletion, 4000);
    return () => clearTimeout(timer);
  }, [completion, dismissCompletion]);

  if (!completion) return null;
  const isSuccess = completion.type === "success";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      style={{ animation: "overlay-fade-in 0.2s ease-out" }}
      onClick={dismissCompletion}
    >
      <div
        className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-lg)]"
        style={{ animation: "overlay-pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-16 w-16 text-[color:var(--color-success)]" strokeWidth={1.5} />
        ) : (
          <XCircle className="h-16 w-16 text-[color:var(--color-danger)]" strokeWidth={1.5} />
        )}
        <h3 className="font-display text-lg font-bold text-blue-900">{completion.title}</h3>
        <p className="text-sm text-gray-600">{completion.message}</p>
      </div>
    </div>
  );
}

export function SyncStatusWidgets() {
  return (
    <>
      <SyncProgressCard />
      <SyncCompletionOverlay />
    </>
  );
}
