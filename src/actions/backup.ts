"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/actions/admin";
import { db } from "@/lib/db";

export type RestoreResult = { error?: string; ok?: boolean };

type BackupData = {
  sellers: Record<string, unknown>[];
  products: Record<string, unknown>[];
  purchases: (Record<string, unknown> & { items: Record<string, unknown>[] })[];
  assignments: (Record<string, unknown> & { items: Record<string, unknown>[] })[];
  sales: Record<string, unknown>[];
  cortes: (Record<string, unknown> & { items: Record<string, unknown>[] })[];
  payments: Record<string, unknown>[];
  retiros: (Record<string, unknown> & { items: Record<string, unknown>[] })[];
  ajustes: (Record<string, unknown> & { items: Record<string, unknown>[] })[];
  /** Opcional: los respaldos anteriores a los gastos no la traen. */
  gastos?: Record<string, unknown>[];
};

export async function restoreBackup(_prev: RestoreResult, formData: FormData): Promise<RestoreResult> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== "CONFIRMAR") return { error: "Escribe CONFIRMAR para restaurar el respaldo." };

  let data: BackupData;
  try {
    data = JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return { error: "El archivo no es un respaldo válido." };
  }
  const need: (keyof BackupData)[] = [
    "sellers",
    "products",
    "purchases",
    "assignments",
    "sales",
    "cortes",
    "payments",
    "retiros",
    "ajustes",
  ];
  for (const k of need) {
    if (!Array.isArray(data[k])) return { error: `El respaldo no tiene la sección "${k}".` };
  }

  const d = await db();
  await d
    .batch([
      d.prepare("DELETE FROM gastos"),
      d.prepare("DELETE FROM ajuste_items"),
      d.prepare("DELETE FROM ajustes"),
      d.prepare("DELETE FROM retiro_items"),
      d.prepare("DELETE FROM retiros"),
      d.prepare("DELETE FROM payments"),
      d.prepare("DELETE FROM corte_items"),
      d.prepare("DELETE FROM sales"),
      d.prepare("DELETE FROM cortes"),
      d.prepare("DELETE FROM assignment_items"),
      d.prepare("DELETE FROM assignments"),
      d.prepare("DELETE FROM purchase_items"),
      d.prepare("DELETE FROM purchases"),
      d.prepare("DELETE FROM products"),
      d.prepare("DELETE FROM sellers"),
    ])
    .catch(() => {});

  const str = (v: unknown): string => String(v ?? "");
  const num = (v: unknown): number => Number(v) || 0;
  const maybeNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

  for (const s of data.sellers) {
    await d
      .prepare(
        "INSERT INTO sellers (id, nombre, telefono, pin_hash, token, activo, last_login) VALUES (?1,?2,?3,?4,?5,?6,?7)",
      )
      .bind(
        str(s.id),
        str(s.nombre),
        str(s.telefono),
        str(s.pin_hash),
        str(s.token),
        num(s.activo),
        maybeNull(s.last_login),
      )
      .run();
  }
  for (const p of data.products) {
    await d
      .prepare(
        "INSERT INTO products (id, codigo, nombre, categoria, costo, precio, activo) VALUES (?1,?2,?3,?4,?5,?6,?7)",
      )
      .bind(
        str(p.id),
        str(p.codigo),
        str(p.nombre),
        str(p.categoria),
        num(p.costo),
        num(p.precio),
        num(p.activo),
      )
      .run();
  }
  for (const pu of data.purchases) {
    await d
      .prepare("INSERT INTO purchases (id, fecha, nota) VALUES (?1,?2,?3)")
      .bind(str(pu.id), str(pu.fecha), str(pu.nota))
      .run();
    for (const it of pu.items ?? []) {
      await d
        .prepare("INSERT INTO purchase_items (purchase_id, product_id, cantidad, costo) VALUES (?1,?2,?3,?4)")
        .bind(str(pu.id), str(it.product_id), num(it.cantidad), num(it.costo))
        .run();
    }
  }
  for (const a of data.assignments) {
    await d
      .prepare("INSERT INTO assignments (id, seller_id, fecha, nota) VALUES (?1,?2,?3,?4)")
      .bind(str(a.id), str(a.seller_id), str(a.fecha), str(a.nota))
      .run();
    for (const it of a.items ?? []) {
      await d
        .prepare(
          "INSERT INTO assignment_items (assignment_id, product_id, cantidad, precio, costo) VALUES (?1,?2,?3,?4,?5)",
        )
        .bind(str(a.id), str(it.product_id), num(it.cantidad), num(it.precio), num(it.costo))
        .run();
    }
  }
  for (const c of data.cortes) {
    await d
      .prepare("INSERT INTO cortes (id, seller_id, fecha, nota) VALUES (?1,?2,?3,?4)")
      .bind(str(c.id), str(c.seller_id), str(c.fecha), str(c.nota))
      .run();
    for (const it of c.items ?? []) {
      await d
        .prepare(
          "INSERT INTO corte_items (corte_id, product_id, cantidad, precio, costo) VALUES (?1,?2,?3,?4,?5)",
        )
        .bind(str(c.id), str(it.product_id), num(it.cantidad), num(it.precio), num(it.costo))
        .run();
    }
  }
  for (const s of data.sales) {
    await d
      .prepare(
        "INSERT INTO sales (id, assignment_id, product_id, cantidad, fecha, corte_id) VALUES (?1,?2,?3,?4,?5,?6)",
      )
      .bind(
        str(s.id),
        str(s.assignment_id),
        str(s.product_id),
        num(s.cantidad),
        str(s.fecha),
        maybeNull(s.corte_id),
      )
      .run();
  }
  for (const p of data.payments) {
    await d
      .prepare(
        "INSERT INTO payments (id, seller_id, corte_id, monto, fecha, nota) VALUES (?1,?2,?3,?4,?5,?6)",
      )
      .bind(str(p.id), str(p.seller_id), maybeNull(p.corte_id), num(p.monto), str(p.fecha), str(p.nota))
      .run();
  }
  for (const r of data.retiros) {
    await d
      .prepare("INSERT INTO retiros (id, seller_id, fecha, destino, nota) VALUES (?1,?2,?3,?4,?5)")
      .bind(str(r.id), str(r.seller_id), str(r.fecha), str(r.destino), str(r.nota))
      .run();
    for (const it of r.items ?? []) {
      await d
        .prepare(
          "INSERT INTO retiro_items (retiro_id, assignment_id, product_id, cantidad) VALUES (?1,?2,?3,?4)",
        )
        .bind(str(r.id), str(it.assignment_id), str(it.product_id), num(it.cantidad))
        .run();
    }
  }
  for (const a of data.ajustes) {
    await d
      .prepare("INSERT INTO ajustes (id, seller_id, fecha, nota) VALUES (?1,?2,?3,?4)")
      .bind(str(a.id), maybeNull(a.seller_id), str(a.fecha), str(a.nota))
      .run();
    for (const it of a.items ?? []) {
      await d
        .prepare(
          "INSERT INTO ajuste_items (ajuste_id, assignment_id, product_id, cantidad) VALUES (?1,?2,?3,?4)",
        )
        .bind(str(a.id), maybeNull(it.assignment_id), str(it.product_id), num(it.cantidad))
        .run();
    }
  }
  for (const g of data.gastos ?? []) {
    await d
      .prepare("INSERT INTO gastos (id, fecha, concepto, categoria, monto) VALUES (?1,?2,?3,?4,?5)")
      .bind(str(g.id), str(g.fecha), str(g.concepto), str(g.categoria), num(g.monto))
      .run();
  }

  revalidatePath("/panel", "layout");
  return { ok: true };
}
