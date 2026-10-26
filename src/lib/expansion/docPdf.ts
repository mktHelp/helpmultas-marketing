import type { ExpansionDoc } from "@/types/database";

const NAVY: [number, number, number] = [36, 55, 70];
const YELLOW: [number, number, number] = [252, 191, 0];
const GRAY: [number, number, number] = [110, 120, 128];

/** Linha só com letras maiúsculas (e números/pontuação): título de seção no padrão do Processo comercial. */
function isHeading(line: string) {
  const t = line.trim();
  return t.length >= 3 && t.length <= 60 && /[A-ZÀ-Ú]/.test(t) && t === t.toUpperCase() && !/^\d+\./.test(t);
}

/** Monta o PDF de leitura de um roteiro/reunião do Processo comercial (gerado no navegador). */
export async function buildDocPdf(doc: Pick<ExpansionDoc, "title" | "kind" | "content" | "updated_at">, folderName: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  const maxW = W - M * 2;
  let y = 0;

  // Cabeçalho
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, W, 92, "F");
  pdf.setFillColor(...YELLOW);
  pdf.rect(0, 92, W, 4, "F");
  pdf.setTextColor(...YELLOW);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(`${doc.kind === "reuniao" ? "REUNIÃO" : "ROTEIRO"} · PROCESSO COMERCIAL · ${folderName.toUpperCase()}`, M, 34);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  const titleLines = pdf.splitTextToSize(doc.title, maxW) as string[];
  pdf.text(titleLines.slice(0, 2), M, 58);
  y = 128;

  const ensure = (h: number) => {
    if (y + h > H - 50) {
      pdf.addPage();
      y = 56;
    }
  };

  for (const raw of doc.content.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      y += 8;
      continue;
    }
    if (isHeading(line)) {
      y += 8;
      ensure(30);
      pdf.setFillColor(...YELLOW);
      pdf.rect(M, y - 10, 3, 14, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...NAVY);
      pdf.text(line.trim(), M + 10, y + 1);
      y += 20;
      continue;
    }
    const bold = /^(Objeção|Resposta|Obje[cç][aã]o|Responsável|Prazo):/i.test(line.trim());
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(10.5);
    pdf.setTextColor(40, 40, 40);
    const indent = /^\s*([-•]|\d+\.)\s/.test(line) ? 8 : 0;
    for (const part of pdf.splitTextToSize(line.trim(), maxW - indent) as string[]) {
      ensure(16);
      pdf.text(part, M + indent, y);
      y += 15;
    }
  }

  // Rodapé com página
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...GRAY);
    pdf.text(`Help Multas · Expansão · atualizado em ${new Date(doc.updated_at).toLocaleDateString("pt-BR")}`, M, H - 28);
    pdf.text(`${i}/${pages}`, W - M, H - 28, { align: "right" });
  }
  return pdf.output("blob");
}

export function docPdfFileName(title: string) {
  return `${title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "documento"}.pdf`;
}

/** Gera e baixa o PDF sem precisar abrir o documento. */
export async function exportDocPdf(doc: Pick<ExpansionDoc, "title" | "kind" | "content" | "updated_at">, folderName: string) {
  const url = URL.createObjectURL(await buildDocPdf(doc, folderName));
  const a = document.createElement("a");
  a.href = url;
  a.download = docPdfFileName(doc.title);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
