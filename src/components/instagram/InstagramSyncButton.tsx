"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useInstagramSync } from "@/lib/instagram-sync-context";

// O estado e o progresso moram em InstagramSyncProvider e aparecem no card
// flutuante global (SyncStatusWidgets) — este botão só dispara e reflete
// se está rodando.
export function InstagramSyncButton() {
  const { state, triggerSync } = useInstagramSync();

  return (
    <Button size="sm" variant="secondary" onClick={triggerSync} disabled={state === "running"}>
      <RefreshCw className={cn("h-4 w-4", state === "running" && "animate-spin")} />
      {state === "running" ? "Sincronizando..." : "Atualizar agora"}
    </Button>
  );
}
