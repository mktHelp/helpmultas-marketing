"use client";

import { useMetaSync } from "@/lib/meta-sync-context";
import { useInstagramSync } from "@/lib/instagram-sync-context";
import { SyncCompletionDialog, SyncProgressCard } from "@/components/shared/SyncWidgets";

// Montado uma vez em app/layout.tsx (dentro dos providers de sync), não
// dentro das páginas — por isso funciona em qualquer tela do Hub, mesmo que
// a sincronização tenha começado em outra aba.

function MetaSyncWidgets() {
  const { state, message, completion, dismissCompletion } = useMetaSync();
  return (
    <>
      {state === "running" && <SyncProgressCard title="Sincronizando Tráfego Pago" message={message} />}
      <SyncCompletionDialog completion={completion} onDismiss={dismissCompletion} />
    </>
  );
}

function InstagramSyncWidgets() {
  const { state, message, completion, dismissCompletion } = useInstagramSync();
  return (
    <>
      {state === "running" && <SyncProgressCard title="Sincronizando Instagram" message={message} />}
      <SyncCompletionDialog completion={completion} onDismiss={dismissCompletion} />
    </>
  );
}

export function SyncStatusWidgets() {
  return (
    <>
      <MetaSyncWidgets />
      <InstagramSyncWidgets />
    </>
  );
}
