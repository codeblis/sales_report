import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type TableSheet = {
  name: string;
  head: string[];
  rows: (string | number)[][];
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Un libro Excel con una hoja por tabla. */
export function exportXlsx(filename: string, sheets: TableSheet[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.head, ...s.rows]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** CSV con BOM UTF-8 (compatible con Excel en español). */
export function exportCsv(filename: string, sheet: TableSheet) {
  const aoa = [sheet.head, ...sheet.rows];
  const csv = aoa
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  download(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

/** PDF con título y una tabla por hoja. */
export function exportPdf(title: string, subtitle: string, sheets: TableSheet[], filename?: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(13);
  doc.text(title, 40, 40);
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(subtitle, 40, 54);
  let y = 68;
  for (let i = 0; i < sheets.length; i++) {
    if (i > 0) doc.addPage();
    y = i > 0 ? 40 : y;
    if (i > 0) {
      doc.setFontSize(13);
      doc.setTextColor(0);
      doc.text(title, 40, 40);
    }
    autoTable(doc, {
      head: [sheets[i].head],
      body: sheets[i].rows,
      startY: i === 0 ? y : 52,
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [45, 45, 52], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 244, 246] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }
  doc.save(`${filename ?? title}.pdf`);
}

/** Backup en JSON. */
export function exportJson(filename: string, data: unknown) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `${filename}.json`);
}
