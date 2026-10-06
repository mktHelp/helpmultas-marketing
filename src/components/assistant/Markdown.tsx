"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Renderiza as respostas do Helpinho (que vêm em markdown: negrito, listas,
// tabelas…) com o visual do app. Links só abrem http(s)/mailto/tel — qualquer
// outro esquema (javascript:, data:) é descartado pelo urlTransform.
function safeUrl(url: string) {
  return /^(https?:|mailto:|tel:|#|\/)/i.test(url) ? url : "";
}

// Links /trafego-pago/leads?anuncio=<metaAdId> viram um preview do criativo
// dentro do chat (carrega ao clicar, pra não chamar a Meta à toa).
function adIdFromHref(href?: string) {
  if (!href?.startsWith("/trafego-pago/leads?")) return null;
  return new URLSearchParams(href.split("?")[1]).get("anuncio")?.trim() || null;
}

function InlineAdPreview({ metaAdId, label, href }: { metaAdId: string; label: ReactNode; href: string }) {
  const [state, setState] = useState<{ open: boolean; url: string | null; loading: boolean; error: string | null }>({ open: false, url: null, loading: false, error: null });

  function toggle() {
    if (state.open) return setState((s) => ({ ...s, open: false }));
    if (state.url) return setState((s) => ({ ...s, open: true }));
    setState({ open: true, url: null, loading: true, error: null });
    fetch(`/api/meta-ads/preview?metaAdId=${encodeURIComponent(metaAdId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao gerar preview");
        setState({ open: true, url: json.previewUrl, loading: false, error: null });
      })
      .catch((err) => setState({ open: true, url: null, loading: false, error: err instanceof Error ? err.message : "Erro ao gerar preview" }));
  }

  return (
    <span className="my-1 block">
      <button
        type="button"
        onClick={toggle}
        className="font-semibold text-blue-800 underline decoration-yellow-500 decoration-2 underline-offset-2 hover:text-blue-900"
      >
        {state.open ? "Ocultar preview" : label}
      </button>
      {state.open && (
        <span className="mt-2 block">
          {state.loading && <span className="text-xs text-gray-500">Carregando preview...</span>}
          {state.error && <span className="text-xs text-[color:var(--color-danger)]">{state.error}</span>}
          {state.url && <iframe src={state.url} title="Preview do anúncio" className="h-[560px] w-full max-w-[340px] rounded-xl border border-gray-200 bg-white" />}
          <Link href={href} className="mt-1 block text-xs text-gray-500 underline">
            Abrir na aba de leads
          </Link>
        </span>
      )}
    </span>
  );
}

export function Markdown({ children, reveal = false, className }: { children: string; reveal?: boolean; className?: string }) {
  return (
    <div className={cn("min-w-0 text-sm leading-relaxed text-blue-900", reveal && "ast-reveal", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={{
          p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-blue-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => {
            const className = "font-semibold text-blue-800 underline decoration-yellow-500 decoration-2 underline-offset-2 hover:text-blue-900";
            const adId = adIdFromHref(href);
            if (href && adId) return <InlineAdPreview metaAdId={adId} label={children} href={href} />;
            // Links internos do app (ex.: /teleprompter?roteiro=…) navegam sem abrir outra aba.
            if (href && href.startsWith("/") && !href.startsWith("//")) {
              return (
                <Link href={href} className={className}>
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                {children}
              </a>
            );
          },
          ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 marker:text-yellow-600 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 marker:font-semibold marker:text-blue-700 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          h1: ({ children }) => <h3 className="mb-2 mt-3 font-display text-base font-bold first:mt-0">{children}</h3>,
          h2: ({ children }) => <h3 className="mb-2 mt-3 font-display text-base font-bold first:mt-0">{children}</h3>,
          h3: ({ children }) => <h4 className="mb-1.5 mt-3 font-display text-sm font-bold first:mt-0">{children}</h4>,
          h4: ({ children }) => <h4 className="mb-1.5 mt-2 font-display text-sm font-bold first:mt-0">{children}</h4>,
          hr: () => <hr className="my-3 border-gray-200" />,
          blockquote: ({ children }) => (
            <blockquote className="mb-2.5 rounded-r-xl border-l-4 border-yellow-500 bg-yellow-050 px-3 py-2 text-blue-800 last:mb-0">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="mb-2.5 overflow-x-auto rounded-xl bg-blue-900 p-3 text-xs leading-relaxed text-white last:mb-0">{children}</pre>
          ),
          code: ({ className: codeClass, children }) =>
            codeClass ? (
              <code className={codeClass}>{children}</code>
            ) : (
              <code className="rounded-md bg-blue-100 px-1.5 py-0.5 font-mono text-[0.85em] text-blue-900">{children}</code>
            ),
          table: ({ children }) => (
            <div className="mb-2.5 max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white last:mb-0">
              <table className="w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-blue-900 text-white">{children}</thead>,
          th: ({ children }) => <th className="whitespace-nowrap px-3 py-2 font-display text-xs font-semibold">{children}</th>,
          tbody: ({ children }) => <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-gray-050">{children}</tbody>,
          td: ({ children }) => <td className="px-3 py-2 align-top text-blue-900">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
