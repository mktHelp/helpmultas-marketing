import type { SupabaseClient } from "@supabase/supabase-js";
import { listTasks } from "@/lib/services/tasks";
import { listAreas, listTaskStatuses } from "@/lib/services/reference";
import { listProfiles } from "@/lib/services/profiles";
import { listSocialAccounts, listRecentFollowerSnapshots } from "@/lib/services/social";
import { listInstagramAudience, listInstagramInsights, listInstagramMedia } from "@/lib/services/instagram";
import { loadLandingLeads, loadTrafficStructure, type LandingLead, type TrafficStructure } from "@/lib/services/meta-ads";
import { toSlimTask, type SlimTask } from "@/lib/home-analytics";
import { shiftDate, todayBRT } from "@/lib/period";
import type { InstagramDailyInsight, InstagramProfileInfo } from "@/types/database";

// Tudo que os relatórios precisam (tarefas, Instagram, Tráfego Pago e leads da
// LP) num único objeto serializável. A aba Relatórios e o PDF executivo usam o
// mesmo loader e o mesmo construtor (lib/reports-data) — os números batem.

export interface ReportIgMedia {
  account_id: string;
  media_id: string;
  product_type: string;
  media_type: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  post_date: string;
  views: number;
  reach: number;
  total_interactions: number;
  like_count: number;
  comments_count: number;
  shares: number;
  saves: number;
}

export interface ReportsRawData {
  tasks: SlimTask[];
  statuses: { key: string; label: string; color: string; is_done: boolean; is_cancelled: boolean }[];
  areas: { id: string; name: string; color: string }[];
  people: { id: string; name: string; avatarUrl: string | null }[];
  instagram: {
    accounts: { id: string; label: string; username: string | null }[];
    insights: InstagramDailyInsight[];
    media: ReportIgMedia[];
    profiles: Record<string, { username?: string; name?: string; followers?: number | null; picture?: string }>;
  };
  traffic: {
    campaigns: { id: string; name: string; budget: number | null; active: boolean }[];
    adSets: { id: string; campaign_id: string }[];
    ads: { id: string; adset_id: string; name: string; thumbnail_url: string; preview_link: string }[];
    insights: TrafficStructure["insights"];
    minDate: string | null;
  };
  leads: LandingLead[];
}

const HISTORY_DAYS = 400;

export async function loadReportsData(supabase: SupabaseClient): Promise<ReportsRawData> {
  const today = todayBRT();
  const [tasks, statuses, areas, profiles, socialAccounts, snapshots, igInsights, igMedia, igAudience, structure, leads] = await Promise.all([
    listTasks(supabase, { light: true, includeArchived: true }),
    listTaskStatuses(supabase),
    listAreas(supabase),
    listProfiles(supabase),
    listSocialAccounts(supabase),
    listRecentFollowerSnapshots(supabase, 3).catch(() => []),
    listInstagramInsights(supabase, HISTORY_DAYS).catch(() => []),
    listInstagramMedia(supabase, HISTORY_DAYS).catch(() => []),
    listInstagramAudience(supabase).catch(() => []),
    loadTrafficStructure(supabase).catch(() => ({ campaigns: [], adSets: [], ads: [], insights: [], minDate: null, maxDate: null }) as TrafficStructure),
    loadLandingLeads(supabase, shiftDate(today, -HISTORY_DAYS), today).catch(() => [] as LandingLead[]),
  ]);

  const igAccounts = socialAccounts.filter((a) => a.platform === "instagram");
  const profileById: ReportsRawData["instagram"]["profiles"] = {};
  for (const a of igAccounts) {
    const info = (igAudience.find((r) => r.account_id === a.id && r.kind === "profile")?.data ?? {}) as InstagramProfileInfo;
    const latest = snapshots
      .filter((s) => s.account_id === a.id)
      .sort((x, y) => y.captured_at.localeCompare(x.captured_at))[0];
    profileById[a.id] = {
      username: info.username ?? a.ig_username ?? undefined,
      name: info.name,
      followers: latest?.followers_count ?? info.followers_count ?? null,
      picture: info.profile_picture_url,
    };
  }

  return {
    tasks: tasks.map(toSlimTask),
    statuses: statuses.map((s) => ({ key: s.key, label: s.label, color: s.color, is_done: s.is_done, is_cancelled: s.is_cancelled })),
    areas: areas.map((a) => ({ id: a.id, name: a.name, color: a.color })),
    people: profiles.filter((p) => p.is_active !== false).map((p) => ({ id: p.id, name: p.full_name, avatarUrl: p.avatar_url })),
    instagram: {
      accounts: igAccounts.map((a) => ({ id: a.id, label: a.label, username: a.ig_username })),
      insights: igInsights,
      media: igMedia.map((m) => ({
        account_id: m.account_id,
        media_id: m.media_id,
        product_type: m.product_type,
        media_type: m.media_type,
        caption: m.caption ? m.caption.slice(0, 140) : null,
        permalink: m.permalink,
        thumbnail_url: m.thumbnail_url,
        post_date: m.post_date,
        views: m.views,
        reach: m.reach,
        total_interactions: m.total_interactions,
        like_count: m.like_count,
        comments_count: m.comments_count,
        shares: m.shares,
        saves: m.saves,
      })),
      profiles: profileById,
    },
    traffic: {
      campaigns: structure.campaigns.map((c) => ({ id: c.id, name: c.name, budget: c.daily_budget, active: c.active_in_meta })),
      adSets: structure.adSets.map((a) => ({ id: a.id, campaign_id: a.campaign_id })),
      ads: structure.ads.map((a) => ({ id: a.id, adset_id: a.adset_id, name: a.name, thumbnail_url: a.thumbnail_url, preview_link: a.preview_link })),
      insights: structure.insights,
      minDate: structure.minDate,
    },
    leads,
  };
}
