"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, X, Copy } from "lucide-react";
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

// Fecha SOMENTE pelo X: sem timer e sem clique no fundo, pra dar tempo de
// ler (e copiar) o detalhe técnico quando a sincronização falha.
function SyncCompletionOverlay() {
  const { completion, dismissCompletion } = useMetaSync();
  const [copied, setCopied] = useState(false);

  if (!completion) return null;
  const isSuccess = completion.type === "success";

  async function copyTechnical() {
    try {
      await navigator.clipboard.writeText(completion?.technical ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      style={{ animation: "overlay-fade-in 0.2s ease-out" }}
    >
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-md flex-col items-center gap-3 overflow-y-auto rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-lg)]"
        style={{ animation: "overlay-pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <button
          onClick={dismissCompletion}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-900"
        >
          <X className="h-5 w-5" />
        </button>
        {isSuccess ? (
          <CheckCircle2 className="h-16 w-16 text-[color:var(--color-success)]" strokeWidth={1.5} />
        ) : (
          <XCircle className="h-16 w-16 text-[color:var(--color-danger)]" strokeWidth={1.5} />
        )}
        <h3 className="font-display text-lg font-bold text-blue-900">{completion.title}</h3>
        <p className="text-sm text-gray-600">{completion.message}</p>

        {!isSuccess && completion.technical && (
          <div className="mt-2 w-full text-left">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase text-gray-500">Detalhe técnico</p>
              <button onClick={copyTechnical} className="flex items-center gap-1 text-xs font-semibold text-blue-900 hover:underline">
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
            <pre className="max-h-48 select-text overflow-auto whitespace-pre-wrap break-all rounded-xl bg-gray-050 p-3 font-mono text-xs text-gray-700">
              {completion.technical}
            </pre>
          </div>
        )}
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
