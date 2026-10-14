"use client";

import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { DistributionTable } from "@/components/distribution/DistributionTable";

export function DistributionPageClient() {
  const [addSignal, setAddSignal] = useState(0);

  return (
    <div>
      <PageHeader
        icon={Send}
        title="Distribuição"
        description="Controle dos posts impulsionados, em tempo real."
        action={
          <Button onClick={() => setAddSignal((n) => n + 1)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova linha
          </Button>
        }
      />
      <DistributionTable addSignal={addSignal} />
    </div>
  );
}
