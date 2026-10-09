"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { summaryRows } from "@/components/reports/ReportsOverview";
import { BRAND, GRID_COLOR, TICK_STYLE, compact, fmt, percent, shortDate, signed } from "@/components/shared/dash-parts";
import { Delta, PageShell, ReportStyle, SectionTitle, longDate, usePrintWhenReady } from "@/components/shared/report-parts";
import { buildReport } from "@/lib/reports-data";
import { REPORT_PERIOD_OPTIONS, reportPeriodLabel, type ReportPeriodKey } from "@/lib/report-period";
import { todayBRT, type DateRange } from "@/lib/period";
import { currencyFormatter } from "@/lib/format";
import { CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_ORDER, categoryFromMedia, type ContentCategory } from "@/lib/services/instagram";
import { connectRate, cpl, ctr, frequency, leadRate } from "@/lib/traffic-analytics";
import type { ReportsRawData } from "@/lib/services/reports";
import { cn } from "@/lib/utils";

// PDF executivo A4: resumo + uma página por frente escolhida (Instagram,
// Tráfego pago, Produção). Mesmo modelo de cálculo da aba Relatórios.

export type ExecSection = "instagram" | "trafego" | "tarefas";
const SECTION_LABEL: Record<ExecSection, string> = { instagram: "Instagram", trafego: "Tráfego pago", tarefas: "Produção" };
const GROUP_OF: Record<ExecSection, "Instagram" | "Tráfego pago" | "Produção"> = { instagram: "Instagram", trafego: "Tráfego pago", tarefas: "Produção" };
const HIGHLIGHT_AREA: Record<ExecSection, string> = { instagram: "instagram", trafego: "trafego", tarefas: "tarefas" };
const CHART_W = 690;
const ACCOUNT_COLORS = [BRAND.blue, BRAND.yellow, BRAND.steel, BRAND.green];

const brl = (n: number) => currencyFormatter.format(n);
const pct2 = (n: number) => `${n.toFixed(2).replace(".", ",")}%`;
const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

export function ExecutiveReport({
  raw, period, range, sections, generatedAt, autoPrint,
}: {
  raw: ReportsRawData;
  period: ReportPeriodKey;
  range: DateRange;
  sections: ExecSection[];
  generatedAt: string;
  autoPrint: boolean;
}) {
  const router = useRouter();
  const paperRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  usePrintWhenReady(paperRef, autoPrint, mounted);

  const today = todayBRT();
  const model = useMemo(() => buildReport(raw, range, today), [raw, range, today]);
  const periodText = reportPeriodLabel(period, range);
  const ig = model.instagram;
  const tr = model.traffic;
  const tk = model.tasks;

  const go = (next: { period?: ReportPeriodKey; from?: string; to?: string; sections?: ExecSection[] }) => {
    const q = new URLSearchParams({
      period: next.period ?? period,
      from: next.from ?? range.from,
      to: next.to ?? range.to,
      sections: (next.sections ?? sections).join(","),
    });
    router.replace(`/relatorio/geral?${q}`);
  };
  const toggle = (s: ExecSection) => {
    const next = sections.includes(s) ? sections.filter((x) => x !== s) : [...sections, s];
    if (next.length) go({ sections: (["instagram", "trafego", "tarefas"] as ExecSection[]).filter((x) => next.includes(x)) });
  };

  const rows = summaryRows(model).filter((r) => sections.some((s) => GROUP_OF[s] === r.group));
  const highlights = model.highlights.filter((h) => h.area === "geral" ? sections.length > 1 : sections.some((s) => HIGHLIGHT_AREA[s] === h.area)).slice(0, 6);
  const single = sections.length === 1;
  const title = single ? `Relatório de ${SECTION_LABEL[sections[0]]}` : "Relatório de Marketing";
  const total = 1 + sections.length;
  const last = sections[sections.length - 1];
  const notes = (
      <div className="absolute bottom-[18mm] left-[12mm] right-[12mm] rounded-lg bg-gray-050 p-3 text-[9px] leading-snug text-gray-500">
        <p className="mb-0.5 font-bold uppercase tracking-wide text-gray-600">Notas metodológicas</p>
        Instagram: API oficial da Meta; alcance e engajamento usam a soma diária de contas únicas; ganho líquido de seguidores cobre no máximo 30 dias.
        Tráfego: Gerenciador de Anúncios da Meta; “Leads (Meta)” são conversões de lead reportadas, “Leads da LP” os recebidos pela landing page.
        Produção: tarefas do Hub; “no prazo” considera as concluídas com prazo; tempo médio = dias entre criação e conclusão. Datas no fuso de São Paulo; o dia
        corrente é parcial e, se incluído, não é comparado. Relatório gerado em {new Date(generatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
      </div>
  );
  const footer = `Help Multas · ${title}`;
  let pageNo = 1;

  const flowSeries = tk.flow.map((d) => ({ label: shortDate(d.date), completed: d.completed, created: d.created }));
  const trSeries = tr.daily.map((d) => ({ label: shortDate(d.date), spend: Math.round(d.spend * 100) / 100, leads: d.leads }));
  const igSeries = ig.daily.map((d) => {
    const row: Record<string, string | number> = { label: shortDate(d.date) };
    ig.accounts.forEach((a) => (row[a.id] = a.daily.find((x) => x.date === d.date)?.views ?? 0));
    return row;
  });
  const catBars = CATEGORY_ORDER.map((c) => ({ c, v: ig.totals.viewsByCategory[c as ContentCategory] ?? 0 })).filter((x) => x.v > 0);
  const maxCat = Math.max(...catBars.map((x) => x.v), 1);
  const maxImp = Math.max(tr.totals.impressions, 1);
  const fw = (v: number) => Math.max((Math.sqrt(v) / Math.sqrt(maxImp)) * 100, 2);

  return (
    <div className="report-root">
      <ReportStyle />

      <div className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <Button size="sm" variant="secondary" onClick={() => router.push("/reports")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar aos Relatórios
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 text-xs font-semibold text-gray-700">
            {(["instagram", "trafego", "tarefas"] as ExecSection[]).map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={sections.includes(s)} onChange={() => toggle(s)} className="h-4 w-4 accent-yellow-500" />
                {SECTION_LABEL[s]}
              </label>
            ))}
          </div>
          <div className="w-44">
            <Select value={period} onChange={(e) => go({ period: e.target.value as ReportPeriodKey })}>
              {REPORT_PERIOD_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </Select>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && go({ from: e.target.value })} className="h-10 rounded-[14px] border border-gray-200 px-3 text-sm text-blue-900" />
              até
              <input type="date" value={range.to} min={range.from} max={today} onChange={(e) => e.target.value && go({ to: e.target.value })} className="h-10 rounded-[14px] border border-gray-200 px-3 text-sm text-blue-900" />
            </div>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        </div>
      </div>

      <div ref={paperRef}>
        {/* ── Resumo ── */}
        <PageShell n={pageNo++} total={total} footer={footer}>
          <header className="-mx-[12mm] -mt-[12mm] mb-5 flex items-center gap-4 bg-blue-900 px-[12mm] py-6 text-white">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Help Multas · Marketing</p>
              <h1 className="font-display text-2xl font-bold leading-tight">{title}</h1>
              <p className="text-sm text-blue-100">{sections.map((s) => SECTION_LABEL[s]).join(" · ")}</p>
            </div>
            <div className="text-right text-xs text-blue-100">
              <p className="text-[10px] uppercase tracking-wide text-blue-200">Período</p>
              <p className="text-sm font-bold text-white">{range.from === range.to ? longDate(range.from) : `${longDate(range.from)} a ${longDate(range.to)}`}</p>
              <p>{periodText}</p>
            </div>
          </header>

          <SectionTitle hint={model.closed ? `Comparado a ${longDate(model.prevRange.from)} – ${longDate(model.prevRange.to)}` : "Período inclui hoje — sem comparação"}>
            Resumo do período
          </SectionTitle>
          <table className="mb-5 w-full text-[10.5px]">
            <thead>
              <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-gray-500">
                <th className="py-1">Indicador</th>
                <th className="py-1 text-right">Período</th>
                <th className="py-1 text-right">Anterior</th>
                <th className="py-1 text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <SummaryGroup key={s} group={GROUP_OF[s]} rows={rows.filter((r) => r.group === GROUP_OF[s])} />
              ))}
            </tbody>
          </table>

          {highlights.length > 0 && (
            <>
              <SectionTitle>Destaques</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {highlights.map((h, i) => (
                  <div key={i} className="rounded-lg border-l-4 border-yellow-500 bg-gray-050 px-3 py-1.5">
                    <p className="text-[11px] font-bold text-blue-900">{h.title}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-gray-600">{h.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </PageShell>

        {/* ── Instagram ── */}
        {sections.includes("instagram") && (
          <PageShell n={pageNo++} total={total} footer={footer}>
            <SectionTitle hint={periodText}>Instagram</SectionTitle>
            {!ig.has ? (
              <p className="py-10 text-center text-[11px] text-gray-400">Sem dados do Instagram neste período.</p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-4 gap-3">
                  {[
                    { l: "Visualizações", v: fmt(ig.totals.views), cur: ig.totals.views, prev: ig.prev.views },
                    { l: "Alcance", v: fmt(ig.totals.reach), cur: ig.totals.reach, prev: ig.prev.reach },
                    { l: "Interações", v: fmt(ig.totals.interactions), cur: ig.totals.interactions, prev: ig.prev.interactions },
                    { l: "Seguidores líquidos", v: signed(ig.totals.netFollowers), cur: 0, prev: null as number | null },
                  ].map((k) => (
                    <div key={k.l} className="rounded-xl border border-gray-200 bg-gray-050 p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{k.l}</p>
                      <p className="mt-0.5 font-display text-lg font-bold text-blue-900">{k.v}</p>
                      <p className="min-h-[12px] text-[9px] text-gray-500">{k.prev != null && ig.hasPrevious ? <Delta cur={k.cur} prev={k.prev} /> : null}</p>
                    </div>
                  ))}
                </div>

                <p className="mb-1 text-[11px] font-bold text-blue-900">Visualizações por dia</p>
                {mounted && (
                  <ComposedChart width={CHART_W} height={180} data={igSeries} margin={{ left: -6, right: 8, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={18} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
                    {ig.accounts.map((a, i) => (
                      <Line key={a.id} type="monotone" dataKey={a.id} stroke={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
                    ))}
                  </ComposedChart>
                )}
                <p className="mb-4 mt-1 flex flex-wrap justify-center gap-3 text-[9px] text-gray-600">
                  {ig.accounts.map((a, i) => (
                    <span key={a.id}><span style={{ color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }}>●</span> {a.label}</span>
                  ))}
                </p>

                <SectionTitle>Comparativo dos perfis</SectionTitle>
                <table className="mb-4 w-full text-[10.5px]">
                  <thead>
                    <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-gray-500">
                      <th className="py-1">Perfil</th>
                      <th className="py-1 text-right">Seguidores</th>
                      <th className="py-1 text-right">Visualizações</th>
                      <th className="py-1 text-right">Alcance</th>
                      <th className="py-1 text-right">Interações</th>
                      <th className="py-1 text-right">Seg. líq.</th>
                      <th className="py-1 text-right">Publicações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ig.accounts.map((a) => (
                      <tr key={a.id} className="border-t border-gray-100">
                        <td className="py-1.5 font-semibold text-blue-900">{a.label}</td>
                        <td className="py-1.5 text-right">{a.followers != null ? fmt(a.followers) : "—"}</td>
                        <td className="py-1.5 text-right font-bold text-blue-900">{fmt(a.totals.views)}</td>
                        <td className="py-1.5 text-right">{fmt(a.totals.reach)}</td>
                        <td className="py-1.5 text-right">{fmt(a.totals.interactions)}</td>
                        <td className="py-1.5 text-right">{signed(a.totals.netFollowers)}</td>
                        <td className="py-1.5 text-right">{fmt(a.pubs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <SectionTitle>Visualizações por tipo</SectionTitle>
                    <div className="space-y-1.5">
                      {catBars.map((x) => (
                        <div key={x.c}>
                          <div className="flex justify-between text-[10.5px]">
                            <span className="font-semibold text-blue-900"><span style={{ color: CATEGORY_COLOR[x.c] }}>●</span> {CATEGORY_LABEL[x.c]}</span>
                            <span>{fmt(x.v)} · {percent(x.v, ig.totals.views, 0)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full" style={{ width: `${(x.v / maxCat) * 100}%`, background: CATEGORY_COLOR[x.c] }} /></div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-gray-100">
                      <div style={{ width: `${ig.totals.views ? (ig.totals.viewsFollowers / ig.totals.views) * 100 : 0}%`, background: BRAND.blue }} />
                      <div style={{ width: `${ig.totals.views ? (ig.totals.viewsNonFollowers / ig.totals.views) * 100 : 0}%`, background: BRAND.yellow }} />
                    </div>
                    <p className="mt-1 text-[9px] text-gray-600">
                      Seguidores {percent(ig.totals.viewsFollowers, ig.totals.views, 0)} · Não seguidores {percent(ig.totals.viewsNonFollowers, ig.totals.views, 0)}
                    </p>
                  </div>
                  <div>
                    <SectionTitle>Top publicações</SectionTitle>
                    <div className="space-y-2">
                      {ig.topPosts.slice(0, 3).map((m, i) => (
                        <div key={m.media_id} className="flex items-center gap-2">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                            {m.thumbnail_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.thumbnail_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                            )}
                            <span className="absolute left-0 top-0 rounded-br-md bg-yellow-500 px-1 text-[9px] font-bold text-blue-900">{i + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[10px] leading-tight text-blue-900">{m.caption || "Sem legenda"}</p>
                            <p className="text-[9px] text-gray-500">{CATEGORY_LABEL[categoryFromMedia(m)]} · {fmt(m.views)} views</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            {last === "instagram" && notes}
          </PageShell>
        )}

        {/* ── Tráfego ── */}
        {sections.includes("trafego") && (
          <PageShell n={pageNo++} total={total} footer={footer}>
            <SectionTitle hint={periodText}>Tráfego pago</SectionTitle>
            {!tr.has ? (
              <p className="py-10 text-center text-[11px] text-gray-400">Sem dados de tráfego pago neste período.</p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-4 gap-3">
                  {[
                    { l: "Investido", v: brl(tr.totals.spend), cur: tr.totals.spend, prev: tr.prev.spend, invert: false },
                    { l: "Leads (Meta)", v: fmt(tr.totals.leads), cur: tr.totals.leads, prev: tr.prev.leads, invert: false },
                    { l: "Custo por lead", v: tr.totals.leads ? brl(cpl(tr.totals)) : "—", cur: cpl(tr.totals), prev: cpl(tr.prev), invert: true },
                    { l: "CTR", v: pct2(ctr(tr.totals)), cur: ctr(tr.totals), prev: ctr(tr.prev), invert: false },
                  ].map((k) => (
                    <div key={k.l} className="rounded-xl border border-gray-200 bg-gray-050 p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{k.l}</p>
                      <p className="mt-0.5 font-display text-lg font-bold text-blue-900">{k.v}</p>
                      <p className="min-h-[12px] text-[9px] text-gray-500">{tr.hasPrevious ? <Delta cur={k.cur} prev={k.prev} invert={k.invert} /> : null}</p>
                    </div>
                  ))}
                </div>

                <p className="mb-1 text-[11px] font-bold text-blue-900">Investido × leads por dia</p>
                {mounted && (
                  <ComposedChart width={CHART_W} height={170} data={trSeries} margin={{ left: -6, right: -6, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={18} />
                    <YAxis yAxisId="l" tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
                    <YAxis yAxisId="r" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Bar yAxisId="l" dataKey="spend" fill={BRAND.blue} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Line yAxisId="r" type="monotone" dataKey="leads" stroke={BRAND.yellow} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                )}

                <div className="mb-4 mt-2 space-y-1">
                  {[
                    { l: "Impressões", v: tr.totals.impressions, w: 100, c: BRAND.blue },
                    { l: `Cliques (CTR ${pct2(ctr(tr.totals))})`, v: tr.totals.clicks, w: fw(tr.totals.clicks), c: BRAND.steel },
                    { l: `Visitas LP (${pct2(connectRate(tr.totals))})`, v: tr.totals.lpViews, w: fw(tr.totals.lpViews), c: "#2a9d8f" },
                    { l: `Leads (${pct2(leadRate(tr.totals))})`, v: tr.totals.leads, w: fw(tr.totals.leads), c: BRAND.green },
                  ].map((f) => (
                    <div key={f.l} className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-[9.5px] font-bold text-blue-900">{f.l}</span>
                      <div className="h-4 flex-1 rounded bg-gray-100"><div className="h-4 rounded" style={{ width: `${f.w}%`, background: f.c }} /></div>
                      <span className="w-16 text-right font-display text-xs font-bold text-blue-900">{fmt(f.v)}</span>
                    </div>
                  ))}
                </div>

                <SectionTitle hint="Top 6 por investimento">Campanhas</SectionTitle>
                <table className="mb-3 w-full text-[10px]">
                  <thead>
                    <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-gray-500">
                      <th className="py-1">Campanha</th>
                      <th className="py-1 text-right">Investido</th>
                      <th className="py-1 text-right">CTR</th>
                      <th className="py-1 text-right">Leads</th>
                      <th className="py-1 text-right">CPL</th>
                      <th className="py-1 text-right">Freq.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tr.campaigns.slice(0, 6).map((c) => (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="max-w-[300px] py-1.5 pr-2 font-semibold leading-tight text-blue-900">{c.name}</td>
                        <td className="py-1.5 text-right font-bold text-blue-900">{brl(c.m.spend)}</td>
                        <td className="py-1.5 text-right">{pct2(ctr(c.m))}</td>
                        <td className="py-1.5 text-right font-bold text-blue-900">{fmt(c.m.leads)}</td>
                        <td className="py-1.5 text-right">{c.m.leads ? brl(cpl(c.m)) : "—"}</td>
                        <td className="py-1.5 text-right">{frequency(c.m) ? frequency(c.m).toFixed(2).replace(".", ",") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[9px] text-gray-500">
                  Leads recebidos na LP: <b className="text-blue-900">{fmt(tr.lpLeads)}</b>
                  {tr.lpLeads > 0 ? ` · CPL real ${brl(tr.totals.spend / tr.lpLeads)}` : ""}
                </p>
              </>
            )}
            {last === "trafego" && notes}
          </PageShell>
        )}

        {/* ── Produção ── */}
        {sections.includes("tarefas") && (
          <PageShell n={pageNo++} total={total} footer={footer}>
            <SectionTitle hint={periodText}>Produção (tarefas)</SectionTitle>
            <div className="mb-4 grid grid-cols-4 gap-3">
              {[
                { l: "Concluídas", v: fmt(tk.done), cur: tk.done, prev: tk.prevDone as number | null, invert: false },
                { l: "Criadas", v: fmt(tk.created), cur: tk.created, prev: tk.prevCreated as number | null, invert: false },
                { l: "No prazo", v: tk.onTime != null ? pct1(tk.onTime) : "—", cur: tk.onTime ?? 0, prev: tk.prevOnTime, invert: false },
                { l: "Tempo médio", v: tk.lead != null ? `${tk.lead.toFixed(1).replace(".", ",")} d` : "—", cur: tk.lead ?? 0, prev: tk.prevLead, invert: true },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-gray-200 bg-gray-050 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{k.l}</p>
                  <p className="mt-0.5 font-display text-lg font-bold text-blue-900">{k.v}</p>
                  <p className="min-h-[12px] text-[9px] text-gray-500">{model.closed && k.prev != null ? <Delta cur={k.cur} prev={k.prev} invert={k.invert} /> : null}</p>
                </div>
              ))}
            </div>

            <p className="mb-1 text-[11px] font-bold text-blue-900">Concluídas (barras) e criadas (linha) por dia</p>
            {mounted && (
              <ComposedChart width={CHART_W} height={170} data={flowSeries} margin={{ left: -24, right: 8, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={18} />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                <Bar dataKey="completed" fill={BRAND.green} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line type="monotone" dataKey="created" stroke={BRAND.yellow} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            )}

            <div className="mt-3 grid grid-cols-2 gap-5">
              <div>
                <SectionTitle>Por área</SectionTitle>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-gray-500">
                      <th className="py-1">Área</th>
                      <th className="py-1 text-right">Concl.</th>
                      <th className="py-1 text-right">Abertas</th>
                      <th className="py-1 text-right">Atras.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tk.byArea.slice(0, 7).map((a) => (
                      <tr key={a.name} className="border-t border-gray-100">
                        <td className="py-1.5 font-semibold text-blue-900"><span style={{ color: a.color }}>●</span> {a.name}</td>
                        <td className="py-1.5 text-right font-bold text-blue-900">{a.completed}</td>
                        <td className="py-1.5 text-right">{a.open}</td>
                        <td className={cn("py-1.5 text-right", a.overdue ? "font-bold text-[#c23b3b]" : "text-gray-400")}>{a.overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <SectionTitle>Situação atual</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: "Em aberto", v: tk.snapshot.open },
                    { l: "Em atraso", v: tk.snapshot.overdue },
                    { l: "Para hoje", v: tk.snapshot.dueToday },
                    { l: "Sem responsável", v: tk.snapshot.unassigned },
                    { l: "Paradas +5 dias", v: tk.snapshot.stuck },
                    { l: "Aguard. aprovação", v: tk.snapshot.awaitingApproval },
                  ].map((g) => (
                    <div key={g.l} className="rounded-lg bg-gray-050 p-2 text-center">
                      <p className="font-display text-base font-bold text-blue-900">{g.v}</p>
                      <p className="text-[9px] font-semibold uppercase text-gray-500">{g.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <SectionTitle hint="Por entregas no período">Equipe</SectionTitle>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-gray-500">
                    <th className="py-1">Pessoa</th>
                    <th className="py-1 text-right">Concluídas</th>
                    <th className="py-1 text-right">Em aberto</th>
                    <th className="py-1 text-right">Atrasadas</th>
                    <th className="py-1 text-right">No prazo</th>
                    <th className="py-1 text-right">Tempo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {tk.team.slice(0, 6).map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="py-1.5 font-semibold text-blue-900">{r.name}</td>
                      <td className="py-1.5 text-right font-bold text-blue-900">{r.completed}</td>
                      <td className="py-1.5 text-right">{r.open}</td>
                      <td className={cn("py-1.5 text-right", r.overdue ? "font-bold text-[#c23b3b]" : "text-gray-400")}>{r.overdue}</td>
                      <td className="py-1.5 text-right">{r.onTime != null ? `${r.onTime.toFixed(0)}%` : "—"}</td>
                      <td className="py-1.5 text-right">{r.leadTime != null ? `${r.leadTime.toFixed(1).replace(".", ",")}d` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {last === "tarefas" && notes}
          </PageShell>
        )}
      </div>
    </div>
  );
}

function SummaryGroup({ group, rows }: { group: string; rows: ReturnType<typeof summaryRows> }) {
  return (
    <>
      <tr>
        <td colSpan={4} className="pb-0.5 pt-2.5 text-[9.5px] font-bold uppercase tracking-wide text-blue-900">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-yellow-500" />
          {group}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.label} className="border-t border-gray-100">
          <td className="py-1 text-blue-900">{r.label}</td>
          <td className="py-1 text-right font-bold text-blue-900">{r.text}</td>
          <td className="py-1 text-right text-gray-500">{r.prevText}</td>
          <td className="py-1 text-right"><Delta cur={r.cur} prev={r.prev} invert={r.invert} /></td>
        </tr>
      ))}
    </>
  );
}
