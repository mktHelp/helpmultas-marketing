"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface SyncResponse {
  ok?: boolean;
  error?: string;
  results?: { account: string; ok: boolean; days?: number; error?: string }[];
}

export function InstagramSyncButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function handleSync() {
    setRunning(true);
    try {
      const res = await fetch("/api/instagram/sync", { method: "POST" });
      const body: SyncResponse = await res.json().catch(() => ({}));
      if (body.error) {
        toast.error(body.error);
        return;
      }
      for (const r of body.results ?? []) {
        if (r.ok) toast.success(`${r.account}: ${r.days} dias atualizados`);
        else toast.error(`${r.account}: ${r.error}`);
      }
      router.refresh();
    } catch {
      toast.error("Erro ao sincronizar o Instagram");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleSync} disabled={running}>
      <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
      {running ? "Atualizando..." : "Atualizar agora"}
    </Button>
  );
}
