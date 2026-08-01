"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/actions/admin";
import { avgCosto } from "@/lib/calculos";
import { db, newId } from "@/lib/db";
import { loadSnapshot } from "@/lib/repo";

export type MutResult = { error?: string; ok?: boolean; count?: number };

/* ============================================================
   PRODUCTOS
   ============================================================ */

export async function createProduct(_prev: MutResult, formData: FormData): Promise<MutResult> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre es obligatorio." };
  const costo = Number(formData.get("costo") ?? 0) || 0;
  const precio = Number(formData.get("precio") ?? 0) || 0;
  const d = await db();
  await d
    .prepare("INSERT INTO products (id, codigo, nombre, categoria, costo, precio) VALUES (?1,?2,?3,?4,?5,?6)")
    .bind(
      newId(),
      String(formData.get("codigo") ?? "").trim(),
      nombre,
      String(formData.get("categoria") ?? "").trim(),
      costo,
      precio,
    )
    .run();
  revalidatePath("/panel/mercancia");
  revalidatePath("/panel", "layout");
  return { ok: true };
}

export async function updateProduct(_prev: MutResult, formData: FormData): Promise<MutResult> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !nombre) return { error: "Faltan datos." };
  const d = await db();
  await d
    .prepare(
      "UPDATE products SET codigo = ?1, nombre = ?2, categoria = ?3, costo = ?4, precio = ?5, activo = ?6 WHERE id = ?7",
    )
    .bind(
      String(formData.get("codigo") ?? "").trim(),
      nombre,
      String(formData.get("categoria") ?? "").trim(),
      Number(formData.get("costo") ?? 0) || 0,
      Number(formData.get("precio") ?? 0) || 0,
      formData.get("activo") === "1" ? 1 : 0,
      id,
    )
    .run();
  revalidatePath("/panel/mercancia");
  revalidatePath("/panel", "layout");
  return { ok: true };
}

export async function importProducts(
  _prev: MutResult & { errors?: string[] },
  formData: FormData,
): Promise<MutResult & { errors?: string[] }> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const raw = String(formData.get("rows") ?? "");
  if (!raw) return { error: "No llegan datos del archivo." };
  let rows: { codigo?: string; nombre?: string; categoria?: string; costo?: number; precio?: number }[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: "Datos del archivo inválidos." };
  }
  const errors: string[] = [];
  let count = 0;
  const d = await db();
  for (const r of rows) {
    const nombre = String(r.nombre ?? "").trim();
    if (!nombre) {
      errors.push("Fila sin nombre de producto.");
      continue;
    }
    try {
      await d
        .prepare(
          "INSERT INTO products (id, codigo, nombre, categoria, costo, precio) VALUES (?1,?2,?3,?4,?5,?6)",
        )
        .bind(
          newId(),
          String(r.codigo ?? "").trim(),
          nombre,
          String(r.categoria ?? "").trim(),
          r.costo ?? 0,
          r.precio ?? 0,
        )
        .run();
      count++;
    } catch (e) {
      errors.push(`${nombre}: ${String(e)}`);
    }
  }
  revalidatePath("/panel/mercancia");
  revalidatePath("/panel", "layout");
  return { ok: true, count, errors };
}

/* ============================================================
   COMPRAS
   ============================================================ */

export async function createPurchase(
  _prev: MutResult & { errors?: string[] },
  formData: FormData,
): Promise<MutResult & { errors?: string[] }> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const fecha = String(formData.get("fecha") ?? "");
  const nota = String(formData.get("nota") ?? "").trim();
  const items: { productId: string; cantidad: number; costo: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const m = /^qty_([^_]+)$/.exec(key);
    if (!m) continue;
    const cantidad = Number(value);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    const costo = Number(formData.get(`cost_${m[1]}`) ?? 0) || 0;
    items.push({ productId: m[1], cantidad, costo });
  }
  if (!fecha || !items.length) return { error: "Faltan datos de la compra." };
  const d = await db();
  const id = newId();
  await d.prepare("INSERT INTO purchases (id, fecha, nota) VALUES (?1,?2,?3)").bind(id, fecha, nota).run();
  for (const it of items) {
    await d
      .prepare("INSERT INTO purchase_items (purchase_id, product_id, cantidad, costo) VALUES (?1,?2,?3,?4)")
      .bind(id, it.productId, it.cantidad, it.costo)
      .run();
  }
  revalidatePath("/panel/compras");
  revalidatePath("/panel", "layout");
  return { ok: true };
}

export async function importPurchases(
  _prev: MutResult & { errors?: string[] },
  formData: FormData,
): Promise<MutResult & { errors?: string[] }> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const raw = String(formData.get("rows") ?? "");
  if (!raw) return { error: "No llegan datos del archivo." };
  let rows: { fecha: string; codigo: string; nombre: string; cantidad: number; costo: number }[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: "Datos del archivo inválidos." };
  }
  const d = await db();
  const products = await d
    .prepare("SELECT id, codigo, nombre FROM products")
    .all<{ id: string; codigo: string; nombre: string }>();
  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const p of products.results) {
    if (p.codigo) byCode.set(p.codigo.toLowerCase(), p.id);
    byName.set(p.nombre.toLowerCase(), p.id);
  }
  const errors: string[] = [];
  const byDate = new Map<
    string,
    { id: string; items: { productId: string; cantidad: number; costo: number }[] }
  >();
  let count = 0;
  for (const r of rows) {
    const key = r.codigo ? byCode.get(r.codigo.toLowerCase()) : undefined;
    const id = key ?? byName.get(r.nombre.toLowerCase());
    if (!id) {
      errors.push(`${r.nombre || r.codigo}: producto no encontrado en el catálogo.`);
      continue;
    }
    const fecha = r.fecha || String(formData.get("fecha") ?? "");
    const g = byDate.get(fecha) ?? { id: newId(), items: [] };
    g.items.push({ productId: id, cantidad: r.cantidad, costo: r.costo });
    byDate.set(fecha, g);
    count++;
  }
  for (const [fecha, g] of byDate) {
    await d
      .prepare("INSERT INTO purchases (id, fecha, nota) VALUES (?1,?2,?3)")
      .bind(g.id, fecha, "Importado")
      .run();
    for (const it of g.items) {
      await d
        .prepare("INSERT INTO purchase_items (purchase_id, product_id, cantidad, costo) VALUES (?1,?2,?3,?4)")
        .bind(g.id, it.productId, it.cantidad, it.costo)
        .run();
    }
  }
  revalidatePath("/panel/compras");
  revalidatePath("/panel", "layout");
  return { ok: true, count, errors };
}

export async function deletePurchase(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const d = await db();
  await d.prepare("DELETE FROM purchase_items WHERE purchase_id = ?1").bind(id).run();
  await d.prepare("DELETE FROM purchases WHERE id = ?1").bind(id).run();
  revalidatePath("/panel/compras");
  revalidatePath("/panel", "layout");
}

/* ============================================================
   ASIGNACIONES
   ============================================================ */

export async function createAssignment(_prev: MutResult, formData: FormData): Promise<MutResult> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const sellerId = String(formData.get("seller_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const nota = String(formData.get("nota") ?? "").trim();
  const items: { productId: string; cantidad: number; precio: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const m = /^qty_([^_]+)$/.exec(key);
    if (!m) continue;
    const cantidad = Number(value);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    items.push({
      productId: m[1],
      cantidad,
      precio: Number(formData.get(`precio_${m[1]}`) ?? 0) || 0,
    });
  }
  if (!sellerId || !fecha || !items.length) return { error: "Faltan datos de la asignación." };

  // Costo congelado: promedio ponderado de las compras del producto.
  const snap = await loadSnapshot();
  const costoDe = new Map<string, number>();
  for (const it of items) costoDe.set(it.productId, avgCosto(snap, it.productId));

  const d = await db();
  const id = newId();
  await d
    .prepare("INSERT INTO assignments (id, seller_id, fecha, nota) VALUES (?1,?2,?3,?4)")
    .bind(id, sellerId, fecha, nota)
    .run();
  for (const it of items) {
    await d
      .prepare(
        "INSERT INTO assignment_items (assignment_id, product_id, cantidad, precio, costo) VALUES (?1,?2,?3,?4,?5)",
      )
      .bind(id, it.productId, it.cantidad, it.precio, costoDe.get(it.productId) ?? 0)
      .run();
  }
  revalidatePath("/panel/asignar");
  revalidatePath("/panel", "layout");
  return { ok: true };
}

export async function deleteAssignment(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const d = await db();
  const sales = await d
    .prepare("SELECT COUNT(*) AS n FROM sales WHERE assignment_id = ?1")
    .bind(id)
    .first<{ n: number }>();
  if ((sales?.n ?? 0) > 0) return;
  await d.prepare("DELETE FROM assignment_items WHERE assignment_id = ?1").bind(id).run();
  await d.prepare("DELETE FROM assignments WHERE id = ?1").bind(id).run();
  revalidatePath("/panel", "layout");
}
