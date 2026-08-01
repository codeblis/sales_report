"use client";

import { exportCsv, exportPdf, exportXlsx, type TableSheet } from "@/lib/export";

export function ExportBar({
  name,
  title,
  subtitle,
  sheets,
}: {
  name: string;
  title: string;
  subtitle: string;
  sheets: TableSheet[];
}) {
  const single = sheets.length === 1;
  return (
    <div className="no-print flex gap-2">
      <button className="btn btn-ghost" type="button" onClick={() => exportXlsx(name, sheets)}>
        Excel
      </button>
      {single && (
        <button className="btn btn-ghost" type="button" onClick={() => exportCsv(name, sheets[0])}>
          CSV
        </button>
      )}
      <button
        className="btn btn-ghost"
        type="button"
        onClick={() => exportPdf(title, subtitle, sheets, name)}
      >
        PDF
      </button>
    </div>
  );
}
