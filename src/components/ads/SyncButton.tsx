"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useMetaSync } from "@/lib/meta-sync-context";

// O estado e o progresso moram em MetaSyncProvider e aparecem no card
// flutuante global (SyncStatusWidgets) — este botão só dispara e reflete
// se está rodando, pra funcionar igual em qualquer página do Hub.
export function SyncButton() {
  const { state, triggerSync } = useMetaSync();

  return (
    <Button size="sm" variant="secondary" onClick={triggerSync} disabled={state === "running"}>
      <RefreshCw className={cn("h-4 w-4", state === "running" && "animate-spin")} />
      {state === "running" ? "Sincronizando..." : "Sincronizar agora"}
    </Button>
  );
}
