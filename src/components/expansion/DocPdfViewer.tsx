"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildDocPdf, docPdfFileName } from "@/lib/expansion/docPdf";
import type { ExpansionDoc } from "@/types/database";

/** Leitura de um documento do Processo comercial como PDF; o lápis leva ao editor. */
export function DocPdfViewer({ doc, folderName, onEdit }: { doc: ExpansionDoc; folderName: string; onEdit: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    buildDocPdf(doc, folderName).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc, folderName]);

  const fileName = docPdfFileName(doc.title);

  return (
    <div className="ast-fade-up min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-display text-sm font-bold text-blue-900">{doc.title}</p>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full p-2 text-gray-500 transition-colors hover:bg-blue-050 hover:text-blue-900"
          aria-label="Editar documento"
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
        {url && (
          <>
            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full p-2 text-gray-500 transition-colors hover:bg-blue-050 hover:text-blue-900" aria-label="Abrir em nova aba" title="Abrir em nova aba">
              <ExternalLink className="h-4 w-4" />
            </a>
            <a href={url} download={fileName}>
              <Button size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Exportar PDF
              </Button>
            </a>
          </>
        )}
      </div>
      {url ? (
        <iframe key={url} src={url} title={doc.title} className="h-[calc(100dvh-300px)] min-h-[480px] w-full rounded-2xl border border-gray-200 bg-gray-050" />
      ) : (
        <div className="flex h-[480px] items-center justify-center rounded-2xl border border-gray-200 text-sm text-gray-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando PDF…
        </div>
      )}
    </div>
  );
}
