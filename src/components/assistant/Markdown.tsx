"use client";

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
