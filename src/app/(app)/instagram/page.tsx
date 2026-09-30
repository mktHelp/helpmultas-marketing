import { PageHeader } from "@/components/shared/PageHeader";
import { InstagramInsights } from "@/components/instagram/InstagramInsights";
import { InstagramSyncButton } from "@/components/instagram/InstagramSyncButton";
import { createClient } from "@/lib/supabase/server";
import { listSocialAccounts, listRecentFollowerSnapshots, listRecentLinkClicks } from "@/lib/services/social";
import { listInstagramAudience, listInstagramInsights, listInstagramMedia } from "@/lib/services/instagram";

export default async function InstagramPage() {
  const supabase = await createClient();
  const [accounts, insights, media, audience, snapshots, linkClicks] = await Promise.all([
    listSocialAccounts(supabase),
    listInstagramInsights(supabase),
    listInstagramMedia(supabase),
    listInstagramAudience(supabase),
    listRecentFollowerSnapshots(supabase, 3),
    listRecentLinkClicks(supabase, 30),
  ]);

  return (
    <div>
      <PageHeader
        title="Instagram"
        description="Insights dos perfis: desempenho, publicações, conteúdos e público. Somente leitura."
        action={<InstagramSyncButton />}
      />
      <InstagramInsights
        accounts={accounts.filter((a) => a.platform === "instagram")}
        insights={insights}
        media={media}
        audience={audience}
        snapshots={snapshots}
        linkClicks={linkClicks}
      />
    </div>
  );
}
