import type { Snapshot } from "@/lib/calculos";
import { db } from "@/lib/db";
import type {
  Ajuste,
  AjusteItem,
  Assignment,
  AssignmentItem,
  Corte,
  CorteItem,
  Gasto,
  Payment,
  Product,
  Purchase,
  PurchaseItem,
  Retiro,
  RetiroItem,
  Sale,
  Seller,
} from "@/lib/types";

const groupBy = <T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> => {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
};

/** Carga todo el estado del negocio en un Snapshot (datos pequeños, un request). */
export async function loadSnapshot(): Promise<Snapshot> {
  const d = await db();
  const [
    sellers,
    products,
    purchases,
    purchaseItems,
    assignments,
    assignmentItems,
    sales,
    cortes,
    corteItems,
    payments,
    retiros,
    retiroItems,
    ajustes,
    ajusteItems,
    gastos,
  ] = await Promise.all([
    d.prepare("SELECT * FROM sellers").all<Seller>(),
    d.prepare("SELECT * FROM products").all<Product>(),
    d.prepare("SELECT * FROM purchases").all<Purchase>(),
    d.prepare("SELECT * FROM purchase_items").all<PurchaseItem>(),
    d.prepare("SELECT * FROM assignments").all<Assignment>(),
    d.prepare("SELECT * FROM assignment_items").all<AssignmentItem>(),
    d.prepare("SELECT * FROM sales").all<Sale>(),
    d.prepare("SELECT * FROM cortes").all<Corte>(),
    d.prepare("SELECT * FROM corte_items").all<CorteItem>(),
    d.prepare("SELECT * FROM payments").all<Payment>(),
    d.prepare("SELECT * FROM retiros").all<Retiro>(),
    d.prepare("SELECT * FROM retiro_items").all<RetiroItem>(),
    d.prepare("SELECT * FROM ajustes").all<Ajuste>(),
    d.prepare("SELECT * FROM ajuste_items").all<AjusteItem>(),
    d.prepare("SELECT * FROM gastos").all<Gasto>(),
  ]);

  const byPurchase = groupBy(purchaseItems.results, (i) => i.purchase_id);
  const byAssignment = groupBy(assignmentItems.results, (i) => i.assignment_id);
  const byCorte = groupBy(corteItems.results, (i) => i.corte_id);
  const byRetiro = groupBy(retiroItems.results, (i) => i.retiro_id);
  const byAjuste = groupBy(ajusteItems.results, (i) => i.ajuste_id);

  return {
    sellers: sellers.results,
    products: products.results,
    purchases: purchases.results.map((p) => ({ ...p, items: byPurchase.get(p.id) ?? [] })),
    assignments: assignments.results.map((a) => ({ ...a, items: byAssignment.get(a.id) ?? [] })),
    sales: sales.results,
    cortes: cortes.results.map((c) => ({ ...c, items: byCorte.get(c.id) ?? [] })),
    payments: payments.results,
    retiros: retiros.results.map((r) => ({ ...r, items: byRetiro.get(r.id) ?? [] })),
    ajustes: ajustes.results.map((a) => ({ ...a, items: byAjuste.get(a.id) ?? [] })),
    gastos: gastos.results,
  };
}

export type ActiveSellerRow = Pick<Seller, "id" | "nombre" | "telefono" | "token" | "activo"> & {
  enlace: string;
};

export async function listSellers(): Promise<Seller[]> {
  const d = await db();
  const r = await d.prepare("SELECT * FROM sellers ORDER BY nombre").all<Seller>();
  return r.results;
}

export async function getSeller(id: string): Promise<Seller | null> {
  const d = await db();
  const r = await d.prepare("SELECT * FROM sellers WHERE id = ?1").bind(id).first<Seller>();
  return r ?? null;
}

export async function getSellerByToken(token: string): Promise<Seller | null> {
  const d = await db();
  const r = await d
    .prepare("SELECT * FROM sellers WHERE token = ?1 AND activo = 1")
    .bind(token)
    .first<Seller>();
  return r ?? null;
}

export async function getProduct(id: string): Promise<Product | null> {
  const d = await db();
  const r = await d.prepare("SELECT * FROM products WHERE id = ?1").bind(id).first<Product>();
  return r ?? null;
}

export async function listProducts(): Promise<Product[]> {
  const d = await db();
  const r = await d.prepare("SELECT * FROM products ORDER BY nombre").all<Product>();
  return r.results;
}
