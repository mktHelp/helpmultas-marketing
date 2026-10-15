/** Exportação da lista de leads (Tráfego Pago › Reuniões) em PDF e XLSX, com os filtros aplicados. */

export interface LeadExportData {
  /** período e filtros aplicados, uma linha "Rótulo: valor" cada */
  filters: [string, string][];
  columns: string[];
  rows: (string | number)[][];
}

const stamp = () => new Date().toISOString().slice(0, 10);
const fileName = (ext: string) => `leads-reunioes-${stamp()}.${ext}`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportLeadsXlsx(d: LeadExportData) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Leads");

  ws.addRow(["Leads · Reuniões"]).font = { bold: true, size: 14 };
  ws.addRow([`Gerado em ${new Date().toLocaleString("pt-BR")} · ${d.rows.length} leads`]);
  ws.addRow([]);
  ws.addRow(["Filtros aplicados"]).font = { bold: true };
  for (const [k, v] of d.filters) ws.addRow([k, v]).getCell(1).font = { bold: true };
  ws.addRow([]);

  const head = ws.addRow(d.columns);
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2A4A" } };
  });
  const headerRow = head.number;
  for (const r of d.rows) ws.addRow(r);

  ws.columns.forEach((col, i) => {
    const longest = Math.max(d.columns[i]?.length ?? 0, ...d.rows.slice(0, 500).map((r) => String(r[i] ?? "").length));
    col.width = Math.min(Math.max(longest + 2, 10), 50);
  });
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: d.columns.length } };
  ws.views = [{ state: "frozen", ySplit: headerRow }];

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName("xlsx"));
}

export async function exportLeadsPdf(d: LeadExportData) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(16);
  doc.text("Leads · Reuniões", 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · ${d.rows.length} leads`, 40, 56);

  doc.setTextColor(30);
  doc.setFontSize(9);
  let y = 76;
  doc.setFont("helvetica", "bold");
  doc.text("Filtros aplicados", 40, y);
  doc.setFont("helvetica", "normal");
  for (const [k, v] of d.filters) {
    y += 13;
    const lines = doc.splitTextToSize(`${k}: ${v}`, 760) as string[];
    doc.text(lines, 40, y);
    y += (lines.length - 1) * 11;
  }

  autoTable(doc, {
    head: [d.columns],
    body: d.rows.map((r) => r.map((c) => String(c))),
    startY: y + 14,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 7.5, cellPadding: 3 },
    headStyles: { fillColor: [11, 42, 74], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(`Página ${doc.getNumberOfPages()}`, 40, h - 20);
    },
  });

  doc.save(fileName("pdf"));
}
