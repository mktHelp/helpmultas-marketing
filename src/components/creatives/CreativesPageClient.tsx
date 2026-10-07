"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { CreativesTable } from "@/components/creatives/CreativesTable";
import { createClient } from "@/lib/supabase/client";
import { listProfiles } from "@/lib/services/profiles";
import type { Profile } from "@/types/database";

export function CreativesPageClient() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [addSignal, setAddSignal] = useState(0);

  useEffect(() => {
    listProfiles(supabase).then(setProfiles).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        icon={ImageIcon}
        title="Criativos"
        description="Controle de entrega de criativos, em tempo real."
        action={
          <Button onClick={() => setAddSignal((n) => n + 1)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova linha
          </Button>
        }
      />
      <CreativesTable profiles={profiles} addSignal={addSignal} />
    </div>
  );
}
