import { rangeLength, shiftDate, type DateRange } from "@/lib/period";
import { previousRange } from "@/lib/report-period";
import {
  buildHomeHighlights, completedIn, createdIn, dailyFlow, isOpen, isOverdueNow, leadTimeDays, onTimeRate, snapshotNow,
  teamPerformance, weekdayOf, PRIORITY_COLOR, PRIORITY_LABEL, type DayPoint, type PersonRow, type SlimTask, type Snapshot,
  type StatusFlags,
} from "@/lib/home-analytics";
import {
  categoryFromMedia, sliceByRange, sumInsights, WEEKDAY_SHORT, type InstagramTotals,
} from "@/lib/services/instagram";
import {
  buildTrafficHighlights, cpl, dailyTM, groupTM, rowsInRange, sumTM, weekdayStats, zeroTM, type TM,
} from "@/lib/traffic-analytics";
import { CONTENT_TYPE_LABEL } from "@/lib/stats";
import type { ReportIgMedia, ReportsRawData } from "@/lib/services/reports";

// Construtor único dos relatórios: recebe os dados crus + o período e devolve
// o modelo já agregado (tarefas, Instagram, Tráfego, destaques). A aba
// Relatórios e o PDF executivo desenham a partir dele.

const brtDay = (iso: string) => new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 10);
const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const nf = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));

export interface AccountReport {
  id: string;
  label: string;
  username?: string;
  picture?: string;
  followers: number | null;
  totals: InstagramTotals;
  prev: InstagramTotals;
  hasPrevious: boolean;
  pubs: number;
  prevPubs: number;
  stories: number;
  daily: { date: string; views: number }[];
}

export interface ReportHighlight {
  area: "geral" | "instagram" | "trafego" | "tarefas";
  title: string;
  text: string;
  tone: "good" | "warn" | "info";
}

export interface TeamRow extends PersonRow {
  name: string;
  avatarUrl: string | null;
}

export interface ReportModel {
  range: DateRange;
  prevRange: DateRange;
  length: number;
  closed: boolean;
  tasks: {
    created: number;
    done: number;
    prevCreated: number;
    prevDone: number;
    onTime: number | null;
    prevOnTime: number | null;
    lead: number | null;
    prevLead: number | null;
    snapshot: Snapshot;
    flow: DayPoint[];
    byArea: { name: string; color: string; completed: number; open: number; overdue: number }[];
    byStatus: { label: string; color: string; count: number }[];
    byContent: { name: string; value: number }[];
    byPriority: { label: string; color: string; value: number }[];
    weekday: { label: string; completed: number; created: number }[];
    team: TeamRow[];
    overdueList: (SlimTask & { areaName: string })[];
    doneList: (SlimTask & { areaName: string })[];
  };
  instagram: {
    has: boolean;
    from: string | null;
    hasPrevious: boolean;
    totals: InstagramTotals;
    prev: InstagramTotals;
    accounts: AccountReport[];
    pubs: number;
    prevPubs: number;
    stories: number;
    daily: { date: string; views: number; net: number; reach: number; interactions: number }[];
    topPosts: (ReportIgMedia & { accountLabel: string })[];
  };
  traffic: {
    has: boolean;
    from: string | null;
    hasPrevious: boolean;
    totals: TM;
    prev: TM;
    daily: (TM & { date: string })[];
    campaigns: { id: string; name: string; budget: number | null; active: boolean; m: TM }[];
    ads: { id: string; name: string; thumbnail_url: string; m: TM }[];
    weekday: ReturnType<typeof weekdayStats>;
    lpLeads: number;
    prevLpLeads: number;
    lpStates: { label: string; value: number }[];
  };
  highlights: ReportHighlight[];
}

export function buildReport(raw: ReportsRawData, range: DateRange, today: string): ReportModel {
  const prevRange = previousRange(range);
  const length = rangeLength(range);
  const closed = range.to < today;

  // ── Tarefas ──
  const flags: StatusFlags = {
    done: new Set(raw.statuses.filter((s) => s.is_done).map((s) => s.key)),
    cancelled: new Set(raw.statuses.filter((s) => s.is_cancelled).map((s) => s.key)),
  };
  const areaById = new Map(raw.areas.map((a) => [a.id, a]));
  const personById = new Map(raw.people.map((p) => [p.id, p]));
  const areaName = (id: string | null) => (id ? (areaById.get(id)?.name ?? "Área") : "Sem área");
  const tasks = raw.tasks;

  const created = createdIn(tasks, range);
  const done = completedIn(tasks, range);
  const prevCreated = createdIn(tasks, prevRange);
  const prevDone = completedIn(tasks, prevRange);
  const snapshot = snapshotNow(tasks, flags, today);
  const openNow = tasks.filter((t) => isOpen(t, flags));

  const areaMap = new Map<string, { name: string; color: string; completed: number; open: number; overdue: number }>();
  const areaEntry = (id: string | null) => {
    const key = id ?? "none";
    if (!areaMap.has(key)) areaMap.set(key, { name: areaName(id), color: id ? (areaById.get(id)?.color ?? "#9aa7af") : "#9aa7af", completed: 0, open: 0, overdue: 0 });
    return areaMap.get(key)!;
  };
  done.forEach((t) => (areaEntry(t.areaId).completed += 1));
  openNow.forEach((t) => {
    const e = areaEntry(t.areaId);
    e.open += 1;
    if (isOverdueNow(t, flags)) e.overdue += 1;
  });

  const contentMap = new Map<string, number>();
  done.forEach((t) => contentMap.set(t.contentType ?? "outros", (contentMap.get(t.contentType ?? "outros") ?? 0) + 1));

  const flow = dailyFlow(tasks, range, flags);
  const weekdayTasks = WEEKDAY_SHORT.map((label, wd) => {
    const days = flow.filter((d) => weekdayOf(d.date) === wd);
    const n = Math.max(days.length, 1);
    return {
      label,
      completed: Number((days.reduce((s, d) => s + d.completed, 0) / n).toFixed(1)),
      created: Number((days.reduce((s, d) => s + d.created, 0) / n).toFixed(1)),
    };
  });

  const team: TeamRow[] = teamPerformance(tasks, range, flags, raw.people.map((p) => p.id)).map((r) => ({
    ...r,
    name: personById.get(r.id)?.name ?? "—",
    avatarUrl: personById.get(r.id)?.avatarUrl ?? null,
  }));
  const withArea = (t: SlimTask) => ({ ...t, areaName: areaName(t.areaId) });
  const overdueList = openNow.filter((t) => isOverdueNow(t, flags)).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")).slice(0, 8).map(withArea);

  const onTime = onTimeRate(done);
  const prevOnTime = onTimeRate(prevDone);

  // ── Instagram ──
  const ig = raw.instagram;
  const igDates = ig.insights.map((r) => r.date).sort();
  const igFrom = igDates[0] ?? null;
  const accounts: AccountReport[] = ig.accounts.map((a) => {
    const slices = sliceByRange(ig.insights.filter((r) => r.account_id === a.id), range);
    const accMedia = ig.media.filter((m) => m.account_id === a.id);
    const inRange = accMedia.filter((m) => m.post_date >= range.from && m.post_date <= range.to);
    const inPrev = accMedia.filter((m) => m.post_date >= prevRange.from && m.post_date <= prevRange.to);
    const isPub = (m: ReportIgMedia) => categoryFromMedia(m) !== "story";
    const prof = ig.profiles[a.id];
    return {
      id: a.id,
      label: a.label,
      username: prof?.username ?? a.username ?? undefined,
      picture: prof?.picture,
      followers: prof?.followers ?? null,
      totals: sumInsights(slices.current),
      prev: sumInsights(slices.previous),
      hasPrevious: slices.hasPrevious,
      pubs: inRange.filter(isPub).length,
      prevPubs: inPrev.filter(isPub).length,
      stories: inRange.filter((m) => !isPub(m)).length,
      daily: slices.current.map((r) => ({ date: r.date, views: r.views })),
    };
  });
  const igCurRows = ig.insights.filter((r) => r.date >= range.from && r.date <= range.to);
  const igPrevRows = ig.insights.filter((r) => r.date >= prevRange.from && r.date <= prevRange.to);
  const igTotals = sumInsights(igCurRows);
  const igPrev = sumInsights(igPrevRows);
  const igDaily: ReportModel["instagram"]["daily"] = [];
  for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) {
    const rows = igCurRows.filter((r) => r.date === d);
    igDaily.push({
      date: d,
      views: rows.reduce((s, r) => s + r.views, 0),
      net: rows.reduce((s, r) => s + r.net_followers, 0),
      reach: rows.reduce((s, r) => s + r.reach, 0),
      interactions: rows.reduce((s, r) => s + r.total_interactions, 0),
    });
  }
  const igHasPrev = closed && igFrom != null && igFrom <= prevRange.from && igPrevRows.length > 0;
  const accountLabel = new Map(ig.accounts.map((a) => [a.id, a.label]));
  const topPosts = ig.media
    .filter((m) => m.post_date >= range.from && m.post_date <= range.to && categoryFromMedia(m) !== "story")
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)
    .map((m) => ({ ...m, accountLabel: accountLabel.get(m.account_id) ?? "" }));
  const igMediaIn = ig.media.filter((m) => m.post_date >= range.from && m.post_date <= range.to);
  const igMediaPrev = ig.media.filter((m) => m.post_date >= prevRange.from && m.post_date <= prevRange.to);

  // ── Tráfego ──
  const tr = raw.traffic;
  const adSetCampaign = new Map(tr.adSets.map((a) => [a.id, a.campaign_id]));
  const adMap = new Map(tr.ads.map((a) => [a.id, a]));
  const curRows = rowsInRange(tr.insights, range, null);
  const prevRows = rowsInRange(tr.insights, prevRange, null);
  const totals = sumTM(curRows);
  const prevTotals = sumTM(prevRows);
  const trHasPrev = closed && !!tr.minDate && tr.minDate <= prevRange.from && prevRows.length > 0;
  const campaignTM = groupTM(curRows, (id) => {
    const ad = adMap.get(id);
    return ad ? (adSetCampaign.get(ad.adset_id) ?? null) : null;
  });
  const adTM = groupTM(curRows, (id) => id);
  const campaigns = tr.campaigns
    .map((c) => ({ ...c, m: campaignTM.get(c.id) ?? zeroTM() }))
    .filter((c) => c.m.spend > 0)
    .sort((a, b) => b.m.spend - a.m.spend);
  const ads = tr.ads
    .map((a) => ({ id: a.id, name: a.name, thumbnail_url: a.thumbnail_url, m: adTM.get(a.id) ?? zeroTM() }))
    .filter((a) => a.m.spend > 0)
    .sort((a, b) => b.m.leads - a.m.leads || a.m.spend - b.m.spend);
  const trDaily = dailyTM(curRows, range);
  const trWeekday = weekdayStats(trDaily);
  const lpIn = raw.leads.filter((l) => brtDay(l.received_at) >= range.from && brtDay(l.received_at) <= range.to);
  const lpPrev = raw.leads.filter((l) => brtDay(l.received_at) >= prevRange.from && brtDay(l.received_at) <= prevRange.to);
  const stateMap = new Map<string, number>();
  lpIn.forEach((l) => {
    const k = l.state?.trim().toUpperCase() || "Não informado";
    stateMap.set(k, (stateMap.get(k) ?? 0) + 1);
  });

  // ── Destaques consolidados ──
  const highlights: ReportHighlight[] = [];
  const taskHighlights = buildHomeHighlights({
    snapshot,
    completed: done.length,
    prevCompleted: closed ? prevDone.length : null,
    onTime,
    prevOnTime: closed ? prevOnTime : null,
    bestWeekday: null,
    worstArea: null,
    topPerson: team[0] ? { name: team[0].name, completed: team[0].completed } : null,
    label: "o período",
  });
  taskHighlights
    .filter((h) => ["overdue", "throughput", "ontime", "top"].includes(h.key))
    .forEach((h) => highlights.push({ area: "tarefas", title: h.title, text: h.text, tone: h.tone }));

  if (igTotals.views > 0) {
    const change = igHasPrev && igPrev.views > 0 ? ((igTotals.views - igPrev.views) / igPrev.views) * 100 : null;
    highlights.push({
      area: "instagram",
      title: change != null ? `Instagram: visualizações ${change >= 0 ? "subiram" : "caíram"} ${Math.abs(change).toFixed(0)}%` : `Instagram: ${nf(igTotals.views)} visualizações`,
      text: `${nf(igTotals.views)} visualizações, ${nf(igTotals.reach)} contas alcançadas e ${nf(igTotals.interactions)} interações no período.`,
      tone: change != null && change < 0 ? "warn" : "good",
    });
    const bestAcc = [...accounts].sort((a, b) => b.totals.views - a.totals.views)[0];
    if (bestAcc && accounts.length > 1) {
      highlights.push({
        area: "instagram",
        title: `${bestAcc.label} lidera em visualizações`,
        text: `${nf(bestAcc.totals.views)} visualizações (${((bestAcc.totals.views / Math.max(igTotals.views, 1)) * 100).toFixed(0)}% do total).`,
        tone: "info",
      });
    }
  }
  if (totals.spend > 0) {
    highlights.push({
      area: "trafego",
      title: `Tráfego: ${brl(totals.spend)} investidos`,
      text: `${nf(totals.leads)} leads${totals.leads ? ` a ${brl(cpl(totals))} por lead` : ""}, ${nf(totals.clicks)} cliques no link.`,
      tone: "info",
    });
    buildTrafficHighlights({
      totals,
      previous: trHasPrev ? prevTotals : null,
      ads: ads.map((a) => ({ id: a.id, name: a.name, m: a.m })),
      campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, m: c.m })),
      weekday: trWeekday,
    })
      .filter((h) => ["bestCpl", "wasted", "cplTrend", "bestCampaign"].includes(h.key))
      .slice(0, 3)
      .forEach((h) => highlights.push({ area: "trafego", title: h.title, text: h.text, tone: h.key === "wasted" ? "warn" : "info" }));
  }
  if (igTotals.views > 0 && totals.leads > 0) {
    highlights.push({
      area: "geral",
      title: "Orgânico e pago juntos",
      text: `${nf(igTotals.views)} visualizações orgânicas no Instagram e ${nf(totals.impressions)} impressões pagas geraram ${nf(totals.leads)} leads no período.`,
      tone: "info",
    });
  }

  return {
    range,
    prevRange,
    length,
    closed,
    tasks: {
      created: created.length,
      done: done.length,
      prevCreated: prevCreated.length,
      prevDone: prevDone.length,
      onTime,
      prevOnTime,
      lead: leadTimeDays(done),
      prevLead: leadTimeDays(prevDone),
      snapshot,
      flow,
      byArea: [...areaMap.values()].sort((a, b) => b.completed + b.open - (a.completed + a.open)),
      byStatus: raw.statuses.map((s) => ({ label: s.label, color: s.color, count: tasks.filter((t) => t.status === s.key).length })).filter((s) => s.count > 0),
      byContent: [...contentMap.entries()].map(([k, value]) => ({ name: k === "outros" ? "Outros" : (CONTENT_TYPE_LABEL[k] ?? k), value })).sort((a, b) => b.value - a.value),
      byPriority: (["urgente", "alta", "media", "baixa"] as const).map((p) => ({ label: PRIORITY_LABEL[p], color: PRIORITY_COLOR[p], value: openNow.filter((t) => t.priority === p).length })).filter((p) => p.value > 0),
      weekday: weekdayTasks,
      team,
      overdueList,
      doneList: done.map(withArea),
    },
    instagram: {
      has: igCurRows.length > 0,
      from: igFrom,
      hasPrevious: igHasPrev,
      totals: igTotals,
      prev: igPrev,
      accounts,
      pubs: igMediaIn.filter((m) => categoryFromMedia(m) !== "story").length,
      prevPubs: igMediaPrev.filter((m) => categoryFromMedia(m) !== "story").length,
      stories: igMediaIn.filter((m) => categoryFromMedia(m) === "story").length,
      daily: igDaily,
      topPosts,
    },
    traffic: {
      has: curRows.length > 0,
      from: tr.minDate,
      hasPrevious: trHasPrev,
      totals,
      prev: prevTotals,
      daily: trDaily,
      campaigns,
      ads,
      weekday: trWeekday,
      lpLeads: lpIn.length,
      prevLpLeads: lpPrev.length,
      lpStates: [...stateMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6),
    },
    highlights,
  };
}
