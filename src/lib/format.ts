/** Formato de números y fechas. La moneda se configura por request. */

const NF = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

let symbol = "$";
let code = "";

export function setCurrency(sym: string, currencyCode = ""): void {
  symbol = sym || "$";
  code = currencyCode || "";
}

export function currencySymbol(): string {
  return symbol;
}

export const money = (n: number): string => {
  const v = Number.isFinite(n) ? n : 0;
  const body = Number.isInteger(v) ? NF0.format(v) : NF.format(v);
  return symbol + body + (code ? ` ${code}` : "");
};

export const moneyRaw = (n: number): string => {
  const v = Number.isFinite(n) ? n : 0;
  return Number.isInteger(v) ? NF0.format(v) : NF.format(v);
};

/**
 * Saldo de un vendedor (`cortado − pagado`). Se vuelve negativo cuando abonó
 * por delante de sus cortes, y "debe -$100" no se entiende: eso es dinero a su
 * favor, así que se enuncia en positivo.
 */
export const saldo = (n: number): string => {
  const v = Number.isFinite(n) ? n : 0;
  return v < 0 ? `${money(-v)} a favor` : money(v);
};

export const qty = (n: number): string => (Number.isFinite(n) ? NF.format(n) : "0");

export const pct = (n: number): string => (Number.isFinite(n) ? `${n.toFixed(1)}%` : "0%");

/** `2026-07-31` → `31/07/2026` */
export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Fecha local del navegador en ISO (y-m-d). */
export function todayISO(d = new Date()): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
