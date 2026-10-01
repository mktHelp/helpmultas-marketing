"use client";

import { useEffect, type RefObject } from "react";

// Peças comuns dos relatórios em PDF A4 (Instagram e Tráfego Pago): folha,
// rodapé, título de seção, variação e o disparo automático da impressão. O PDF
// sai pelo "Salvar como PDF" do diálogo de impressão do navegador.

export function longDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

export function avg(values: number[]) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

export function ReportStyle() {
  return (
    <style>{`
      @page { size: A4; margin: 0; }
      .report-root { background: #e9edf0; min-height: 100vh; padding-bottom: 32px; }
      .report-page { position: relative; width: 210mm; height: 297mm; padding: 12mm 12mm 18mm; margin: 16px auto; background: #fff;
        box-shadow: 0 2px 14px rgba(36,55,70,.18); overflow: hidden; box-sizing: border-box; }
      @media screen and (max-width: 860px) { .report-page { zoom: 0.8; } }
      @media screen and (max-width: 660px) { .report-page { zoom: 0.62; } }
      @media screen and (max-width: 480px) { .report-page { zoom: 0.46; } }
      @media print {
        html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .report-root { background: #fff; padding: 0; min-height: 0; }
        .report-page { zoom: 1; margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
        .report-page:last-of-type { break-after: auto; page-break-after: auto; }
        .no-print { display: none !important; }
      }
    `}</style>
  );
}

export function PageShell({ n, total, footer, children }: { n: number; total: number; footer: string; children: React.ReactNode }) {
  return (
    <section className="report-page">
      {children}
      <footer className="absolute bottom-[8mm] left-[12mm] right-[12mm] flex justify-between border-t border-gray-200 pt-2 text-[10px] text-gray-400">
        <span>{footer}</span>
        <span>
          Página {n} de {total}
        </span>
      </footer>
    </section>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between border-b-2 border-yellow-500 pb-1">
      <h2 className="font-display text-[15px] font-bold text-blue-900">{children}</h2>
      {hint && <span className="text-[10px] text-gray-500">{hint}</span>}
    </div>
  );
}

// invert: nos custos (CPL, CPC...) subir é ruim.
export function Delta({ cur, prev, invert }: { cur: number; prev: number | null; invert?: boolean }) {
  if (prev == null || (prev === 0 && cur === 0)) return <span className="text-gray-400">—</span>;
  const change = prev === 0 ? 100 : ((cur - prev) / Math.abs(prev)) * 100;
  const up = change > 0.5;
  const down = change < -0.5;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  return (
    <span className={good ? "font-bold text-[#2f8f5b]" : bad ? "font-bold text-[#c23b3b]" : "text-gray-500"}>
      {up ? "▲" : down ? "▼" : "•"} {Math.abs(change) >= 1000 ? ">999" : Math.abs(change).toFixed(1).replace(".", ",")}%
    </span>
  );
}

// Abre o diálogo de impressão depois que gráficos e miniaturas carregaram.
export function usePrintWhenReady(paperRef: RefObject<HTMLDivElement | null>, enabled: boolean, mounted: boolean) {
  useEffect(() => {
    if (!enabled || !mounted) return;
    const imgs = Array.from(paperRef.current?.querySelectorAll("img") ?? []);
    const loaded = Promise.all(
      imgs.map((img) =>
        img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); })
      )
    );
    const timeout = new Promise<void>((res) => setTimeout(res, 6000));
    Promise.race([loaded, timeout]).then(() => setTimeout(() => window.print(), 700));
  }, [enabled, mounted, paperRef]);
}
