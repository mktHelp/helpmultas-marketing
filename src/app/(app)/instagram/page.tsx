import { PageHeader } from "@/components/shared/PageHeader";
import { InstagramInsights } from "@/components/instagram/InstagramInsights";
import { InstagramSyncButton } from "@/components/instagram/InstagramSyncButton";
import { createClient } from "@/lib/supabase/server";
import { listSocialAccounts, listRecentFollowerSnapshots, listRecentLinkClicks } from "@/lib/services/social";
import { listInstagramInsights } from "@/lib/services/instagram";

export default async function InstagramPage() {
  const supabase = await createClient();
  const [accounts, insights, snapshots, linkClicks] = await Promise.all([
    listSocialAccounts(supabase),
    listInstagramInsights(supabase, 30),
    listRecentFollowerSnapshots(supabase, 3),
    listRecentLinkClicks(supabase, 30),
  ]);

  return (
    <div>
      <PageHeader
        title="Instagram"
        description="Insights dos perfis: visualizações, seguidores, interações e tipos de conteúdo. Somente leitura."
        action={<InstagramSyncButton />}
      />
      <InstagramInsights
        accounts={accounts.filter((a) => a.platform === "instagram")}
        insights={insights}
        snapshots={snapshots}
        linkClicks={linkClicks}
      />
    </div>
  );
}
