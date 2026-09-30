import {
  CATEGORY_LABEL, CATEGORY_ORDER, WEEKDAY_LONG, categoryFromMedia, engagementRate, sumInsights, weekdayOf,
} from "@/lib/services/instagram";
import type { InstagramDailyInsight, InstagramMedia } from "@/types/database";

// Leitura automática do período, usada pelos "Destaques" da dashboard e pelo
// relatório em PDF — mesma lógica nos dois lugares.

export type HighlightKey = "weekday" | "reach" | "format" | "engagement" | "topPost" | "record" | "consistency" | "followers";

export interface Highlight {
  key: HighlightKey;
  title: string;
  text: string;
}

const nf = new Intl.NumberFormat("pt-BR");
const n0 = (n: number) => nf.format(Math.round(n));
const signed = (n: number) => `${n > 0 ? "+" : ""}${nf.format(n)}`;

function avg(values: number[]) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function tipDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

export function buildHighlights(rows: InstagramDailyInsight[], media: InstagramMedia[]): Highlight[] {
  const out: Highlight[] = [];
  const t = sumInsights(rows);

  // Melhor dia da semana (média de visualizações)
  const byWeekday = WEEKDAY_LONG.map((label, wd) => {
    const dayRows = rows.filter((r) => weekdayOf(r.date) === wd);
    return { label, views: avg(dayRows.map((r) => r.views)), samples: dayRows.length };
  }).filter((w) => w.samples > 0);
  const bestWd = [...byWeekday].sort((a, b) => b.views - a.views)[0];
  if (bestWd && bestWd.views > 0) {
    out.push({
      key: "weekday",
      title: `Melhor dia: ${bestWd.label}`,
      text: `Média de ${n0(bestWd.views)} visualizações por dia nesse dia da semana, a maior do período.`,
    });
  }

  if (t.views > 0) {
    const nonShare = (t.viewsNonFollowers / t.views) * 100;
    out.push({
      key: "reach",
      title: `${nonShare.toFixed(0)}% das views vêm de quem não te segue`,
      text:
        nonShare >= 50
          ? "O conteúdo está sendo descoberto organicamente — bom sinal de alcance fora da base."
          : "O conteúdo é mais consumido pela própria base. Reels e colabs ajudam a alcançar novos públicos.",
    });
  }

  const perFormat = CATEGORY_ORDER.map((c) => {
    const items = media.filter((m) => categoryFromMedia(m) === c && m.views > 0);
    return { c, n: items.length, avg: avg(items.map((m) => m.views)) };
  })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.avg - a.avg);
  if (perFormat[0]) {
    out.push({
      key: "format",
      title: `${CATEGORY_LABEL[perFormat[0].c]} têm a melhor média`,
      text: `${n0(perFormat[0].avg)} visualizações por publicação (${perFormat[0].n} no período).`,
    });
  }

  if (t.reach > 0) {
    const er = engagementRate(t.interactions, t.reach);
    out.push({
      key: "engagement",
      title: `Taxa de engajamento de ${er.toFixed(1).replace(".", ",")}%`,
      text: `${n0(t.interactions)} interações sobre ${n0(t.reach)} contas alcançadas (soma diária).`,
    });
  }

  const topPost = [...media].filter((m) => categoryFromMedia(m) !== "story").sort((a, b) => b.views - a.views)[0];
  if (topPost && topPost.views > 0) {
    const caption = topPost.caption?.replace(/\s+/g, " ") ?? "";
    out.push({
      key: "topPost",
      title: "Publicação mais vista do período",
      text: `${n0(topPost.views)} visualizações${caption ? ` — “${caption.slice(0, 60)}${caption.length > 60 ? "…" : ""}”` : ""}`,
    });
  }

  const bestDay = rows.reduce<InstagramDailyInsight | null>((m, r) => (!m || r.views > m.views ? r : m), null);
  if (bestDay && bestDay.views > 0) {
    out.push({
      key: "record",
      title: `Recorde: ${tipDate(bestDay.date)}`,
      text: `${n0(bestDay.views)} visualizações em um único dia.`,
    });
  }

  if (media.length > 0) {
    const dates = new Set(rows.map((r) => r.date));
    media.forEach((m) => dates.add(m.post_date));
    const postedDays = new Set(media.filter((m) => categoryFromMedia(m) !== "story").map((m) => m.post_date));
    const without = Array.from(dates).filter((d) => !postedDays.has(d)).length;
    if (without > 0) {
      out.push({
        key: "consistency",
        title: `${without} dia${without > 1 ? "s" : ""} sem feed/reels`,
        text: "Consistência de publicação costuma puxar alcance — confira o gráfico de publicações por dia.",
      });
    }
  }

  const netRows = rows.slice(-Math.min(rows.length, 30));
  if (netRows.some((r) => r.net_followers !== 0)) {
    const net = netRows.reduce((s, r) => s + r.net_followers, 0);
    out.push({
      key: "followers",
      title: `${signed(net)} seguidores em ${netRows.length} dias`,
      text: `Média de ${signed(Math.round(net / Math.max(netRows.length, 1)))} por dia.`,
    });
  }

  return out;
}
