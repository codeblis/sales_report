"use client";

import { useRef, useState } from "react";
import { importProducts, importPurchases } from "@/actions/catalogo";
import { type ParsedBook, parseProducts, parsePurchases, readFile } from "@/lib/parse";

type SubmitResult = { error?: string; ok?: boolean; count?: number; errors?: string[] };

/**
 * Importación masiva desde Excel. Recibe solo props serializables: el parser y
 * la acción de guardado se eligen aquí a partir de `kind`, porque una página
 * servidor no puede pasar funciones a un componente cliente.
 */
export function ExcelDrop({
  kind,
  label,
  hint,
  submitLabel,
  fechaDefault,
}: {
  kind: "productos" | "compras";
  label: string;
  hint: string;
  submitLabel: string;
  /** Fecha de respaldo para las filas de compra que no la traigan. */
  fechaDefault: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<unknown[] | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const parse = (book: ParsedBook): unknown[] =>
    kind === "productos" ? parseProducts(book) : parsePurchases(book, fechaDefault);

  async function onFile(f: File | null) {
    setResult(null);
    if (!f) return;
    try {
      const books = await readFile(f);
      for (const book of books) {
        const r = parse(book);
        if (r.length) {
          setRows(r);
          setSheetName(book.sheetName);
          return;
        }
      }
      setResult({ error: "No se encontró una tabla reconocible en el archivo." });
    } catch (e) {
      setResult({ error: `No se pudo leer el archivo: ${String(e)}` });
    }
  }

  async function doImport() {
    if (!rows) return;
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.append("rows", JSON.stringify(rows));
    let r: SubmitResult;
    if (kind === "productos") {
      r = await importProducts({}, fd);
    } else {
      fd.append("fecha", fechaDefault);
      r = await importPurchases({}, fd);
    }
    setResult(r);
    if (r.ok) setRows(null);
    setBusy(false);
  }

  const preview = (rows?.[0] as Record<string, unknown> | undefined) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {!rows && (
        <button className="btn" type="button" onClick={() => inputRef.current?.click()}>
          <span className="ico" aria-hidden="true">
            ⤓
          </span>
          {label}
        </button>
      )}
      <p className="text-xs dim">{hint}</p>

      {rows && (
        <div className="flex flex-col gap-3">
          <p className="notice" style={{ marginBottom: 0 }}>
            <b>{rows.length}</b> filas detectadas en <b>{sheetName}</b>. Revisa la vista previa y confirma.
          </p>
          {preview && (
            <div className="tscroll" style={{ maxHeight: 220 }}>
              <table style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    {Object.keys(preview).map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 6).map((r) => (
                    <tr key={JSON.stringify(r).slice(0, 80)}>
                      {Object.entries(r as Record<string, unknown>).map(([k, v]) => (
                        <td key={`cell-${k}`}>{String(v ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-solid" type="button" disabled={busy} onClick={doImport}>
              {busy ? "Importando…" : submitLabel}
            </button>
            <button className="btn" type="button" onClick={() => setRows(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {result?.error && (
        <p className="notice" role="alert">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <p className="notice" role="status">
          <b>{result.count}</b> registros importados.
          {result.errors?.length
            ? " Se omitieron: " +
              result.errors.slice(0, 3).join(" · ") +
              (result.errors.length > 3 ? " …" : "")
            : ""}
        </p>
      )}
    </div>
  );
}
