"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { CreativesTable } from "@/components/creatives/CreativesTable";
import { createClient } from "@/lib/supabase/client";
import { listProfiles } from "@/lib/services/profiles";
import type { Profile } from "@/types/database";

export function CreativesPageClient() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    listProfiles(supabase).then(setProfiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="Criativos" description="Controle de entrega de criativos, em tempo real." />
      <CreativesTable profiles={profiles} />
    </div>
  );
}
