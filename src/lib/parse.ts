import * as XLSX from "xlsx";

/**
 * Lectura de libros Excel/CSV para altas masivas.
 * Portado del prototipo original: encabezados por sinónimos, orden y fila libre.
 */

const FIELDS: Record<string, string[]> = {
  codigo: ["codigo", "cod", "sku", "clave", "referencia", "ref", "id"],
  nombre: ["producto", "nombre", "descripcion", "articulo", "item", "detalle", "mercancia"],
  categoria: ["categoria", "categoría", "tipo", "grupo", "seccion", "sección"],
  costo: ["costo", "coste", "precio de compra", "precio compra", "costo unitario", "compra"],
  precio: ["precio unitario", "precio unit", "precio de venta", "valor unitario", "precio", "venta", "pu"],
  cantidad: ["cantidad", "cant", "unidades", "uds", "existencia", "existencias", "stock"],
  fecha: ["fecha", "dia", "día"],
};

function norm(s: unknown): string {
  return String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v)
    .trim()
    .replace(/[^0-9.,-]/g, "");
  if (!s || s === "-") return 0;
  const c = s.lastIndexOf(",");
  const d = s.lastIndexOf(".");
  if (c > -1 && d > -1) {
    s = c > d ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (c > -1) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

type HeaderMap = { field: string; col: number }[];

function mapHeader(row: unknown[]): HeaderMap {
  const best = new Map<string, { col: number; score: number }>();
  row.forEach((cell, col) => {
    const h = norm(cell);
    if (!h) return;
    for (const [field, syns] of Object.entries(FIELDS)) {
      for (const syn of syns) {
        if (h === syn || h.startsWith(`${syn} `) || h.includes(syn)) {
          const score = syn.length + (h === syn ? 100 : 0);
          const cur = best.get(field);
          if (!cur || score > cur.score) best.set(field, { col, score });
          break;
        }
      }
    }
  });
  const taken = new Map<number, string>();
  for (const [field, info] of best) {
    const rival = taken.get(info.col);
    if (!rival || (best.get(rival)?.score ?? 0) < info.score) {
      if (rival) best.delete(rival);
      taken.set(info.col, field);
    } else {
      best.delete(field);
    }
  }
  return [...best.entries()].map(([field, info]) => ({ field, col: info.col }));
}

function findHeader(rows: unknown[][]): { row: number; map: HeaderMap } | null {
  let win: { row: number; map: HeaderMap; has: number } | null = null;
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const map = mapHeader(rows[i] ?? []);
    const has = map.length;
    if (has >= 2 && (!win || has > win.has)) win = { row: i, map, has };
  }
  return win ? { row: win.row, map: win.map } : null;
}

export type ParsedBook = {
  rows: unknown[][];
  sheetName: string;
};

/** Lee un archivo (ArrayBuffer o texto) y devuelve todas las hojas como filas. */
export async function readFile(file: File): Promise<ParsedBook[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(data), { type: "array" });
  return wb.SheetNames.map((name) => ({
    sheetName: name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      blankrows: false,
      defval: null,
    }) as unknown[][],
  }));
}

function get(map: HeaderMap, rows: unknown[][], headRow: number, field: string): unknown[] {
  const f = map.find((m) => m.field === field);
  return f ? rows.slice(headRow + 1).map((r) => r[f.col]) : [];
}

/** Productos: Código, Producto, Categoría, Costo, Precio. */
export type ParsedProduct = {
  codigo: string;
  nombre: string;
  categoria: string;
  costo: number;
  precio: number;
  /**
   * Cantidad, si la hoja la trae. El catálogo no la usa —un producto no tiene
   * existencias por sí mismo—, pero con ella se puede proponer la compra que
   * mete esa mercancía en el almacén, que es lo que uno espera al importar una
   * hoja con cantidades.
   */
  cantidad: number;
};

export function parseProducts(sheet: ParsedBook): ParsedProduct[] {
  const head = findHeader(sheet.rows);
  if (!head) return [];
  const out: ParsedProduct[] = [];
  const codes = get(head.map, sheet.rows, head.row, "codigo");
  const names = get(head.map, sheet.rows, head.row, "nombre");
  const cats = get(head.map, sheet.rows, head.row, "categoria");
  const costs = get(head.map, sheet.rows, head.row, "costo");
  const prices = get(head.map, sheet.rows, head.row, "precio");
  const qtys = get(head.map, sheet.rows, head.row, "cantidad");
  for (let i = 0; i < names.length; i++) {
    const nombre = String(names[i] ?? "").trim();
    if (!nombre) continue;
    if (/^totales?$/i.test(nombre)) continue;
    out.push({
      codigo: String(codes[i] ?? "").trim(),
      nombre,
      categoria: String(cats[i] ?? "").trim(),
      costo: toNum(costs[i]),
      precio: toNum(prices[i]),
      cantidad: toNum(qtys[i]),
    });
  }
  return out;
}

/** Compras: Fecha (opcional), Producto o Código, Cantidad, Costo. */
export type ParsedPurchaseRow = {
  fecha: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  costo: number;
};

export function parsePurchases(sheet: ParsedBook, fallbackDate: string): ParsedPurchaseRow[] {
  const head = findHeader(sheet.rows);
  if (!head) return [];
  const out: ParsedPurchaseRow[] = [];
  const dates = get(head.map, sheet.rows, head.row, "fecha");
  const codes = get(head.map, sheet.rows, head.row, "codigo");
  const names = get(head.map, sheet.rows, head.row, "nombre");
  const qty = get(head.map, sheet.rows, head.row, "cantidad");
  const costs = get(head.map, sheet.rows, head.row, "costo");
  const n = Math.max(names.length, codes.length);
  for (let i = 0; i < n; i++) {
    const nombre = String(names[i] ?? "").trim();
    const codigo = String(codes[i] ?? "").trim();
    if (!nombre && !codigo) continue;
    const cantidad = toNum(qty[i]);
    if (cantidad <= 0) continue;
    const rawDate = dates[i];
    const fecha =
      typeof rawDate === "number" && rawDate > 20000
        ? XLSX.SSF.format("yyyy-mm-dd", rawDate)
        : typeof rawDate === "string" && rawDate
          ? rawDate.slice(0, 10)
          : fallbackDate;
    out.push({ fecha: fecha || fallbackDate, codigo, nombre, cantidad, costo: toNum(costs[i]) });
  }
  return out;
}
