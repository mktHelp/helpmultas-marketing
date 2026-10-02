"use client";

import { useMetaSync } from "@/lib/meta-sync-context";
import { useInstagramSync } from "@/lib/instagram-sync-context";
import {
  SyncCompletionDialog,
  SyncCompletionStack,
  SyncProgressCard,
  SyncProgressStack,
} from "@/components/shared/SyncWidgets";

// Montado uma vez em app/layout.tsx (dentro dos providers de sync), não
// dentro das páginas — por isso funciona em qualquer tela do Hub, mesmo que
// a sincronização tenha começado em outra aba.

export function SyncStatusWidgets() {
  const meta = useMetaSync();
  const ig = useInstagramSync();
  const hasProgress = meta.state === "running" || ig.state === "running";
  const hasCompletion = !!meta.completion || !!ig.completion;

  return (
    <>
      {hasProgress && (
        <SyncProgressStack>
          {meta.state === "running" && <SyncProgressCard title="Sincronizando Tráfego Pago" message={meta.message} />}
          {ig.state === "running" && <SyncProgressCard title="Sincronizando Instagram" message={ig.message} />}
        </SyncProgressStack>
      )}
      {hasCompletion && (
        <SyncCompletionStack>
          <SyncCompletionDialog completion={meta.completion} onDismiss={meta.dismissCompletion} />
          <SyncCompletionDialog completion={ig.completion} onDismiss={ig.dismissCompletion} />
        </SyncCompletionStack>
      )}
    </>
  );
}
