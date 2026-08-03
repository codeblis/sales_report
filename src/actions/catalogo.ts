"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/actions/admin";
import { avgCosto, warehouseLines, warehouseStock } from "@/lib/calculos";
import { db, newId } from "@/lib/db";
import { loadSnapshot } from "@/lib/repo";

export type MutResult = { error?: string; ok?: boolean; count?: number; updated?: number };

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
  let updated = 0;
  const d = await db();

  // Reimportar el mismo archivo no debe duplicar el catálogo: se empareja por
  // código y, si no lo hay, por nombre. Lo que ya existe se actualiza.
  const existentes = await d
    .prepare("SELECT id, codigo, nombre FROM products")
    .all<{ id: string; codigo: string; nombre: string }>();
  const porCodigo = new Map<string, string>();
  const porNombre = new Map<string, string>();
  for (const p of existentes.results) {
    if (p.codigo) porCodigo.set(p.codigo.toLowerCase(), p.id);
    porNombre.set(p.nombre.toLowerCase(), p.id);
  }

  for (const r of rows) {
    const nombre = String(r.nombre ?? "").trim();
    if (!nombre) {
      errors.push("Fila sin nombre de producto.");
      continue;
    }
    const codigo = String(r.codigo ?? "").trim();
    const categoria = String(r.categoria ?? "").trim();
    const costo = r.costo ?? 0;
    const precio = r.precio ?? 0;
    const yaExiste =
      (codigo ? porCodigo.get(codigo.toLowerCase()) : undefined) ?? porNombre.get(nombre.toLowerCase());
    try {
      if (yaExiste) {
        await d
          .prepare(
            "UPDATE products SET codigo = ?1, nombre = ?2, categoria = ?3, costo = ?4, precio = ?5 WHERE id = ?6",
          )
          .bind(codigo, nombre, categoria, costo, precio, yaExiste)
          .run();
        updated++;
      } else {
        const id = newId();
        await d
          .prepare(
            "INSERT INTO products (id, codigo, nombre, categoria, costo, precio) VALUES (?1,?2,?3,?4,?5,?6)",
          )
          .bind(id, codigo, nombre, categoria, costo, precio)
          .run();
        // Se registra al vuelo para que un archivo con la fila repetida
        // tampoco cree dos productos.
        if (codigo) porCodigo.set(codigo.toLowerCase(), id);
        porNombre.set(nombre.toLowerCase(), id);
        count++;
      }
    } catch (e) {
      errors.push(`${nombre}: ${String(e)}`);
    }
  }
  revalidatePath("/panel/mercancia");
  revalidatePath("/panel", "layout");
  return { ok: true, count, updated, errors };
}

/**
 * Borra un producto, solo si nunca se usó. Uno que ya aparece en una compra,
 * asignación, venta, corte, recogida o ajuste sostiene esos cálculos: borrarlo
 * dejaría las líneas sin producto y descuadraría los reportes. Para retirarlo
 * de la circulación sin perder el historial está el interruptor de "activo".
 */
export async function deleteProduct(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const d = await db();
  const uso = await d
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM purchase_items   WHERE product_id = ?1) AS compras,
         (SELECT COUNT(*) FROM assignment_items WHERE product_id = ?1) AS asignaciones,
         (SELECT COUNT(*) FROM sales            WHERE product_id = ?1) AS ventas,
         (SELECT COUNT(*) FROM corte_items      WHERE product_id = ?1) AS cortes,
         (SELECT COUNT(*) FROM retiro_items     WHERE product_id = ?1) AS recogidas,
         (SELECT COUNT(*) FROM ajuste_items     WHERE product_id = ?1) AS ajustes`,
    )
    .bind(id)
    .first<Record<string, number>>();
  const historial = Object.values(uso ?? {}).reduce((s, n) => s + Number(n ?? 0), 0);
  if (historial > 0) redirect("/panel/mercancia?error=historial");

  await d.prepare("DELETE FROM products WHERE id = ?1").bind(id).run();
  revalidatePath("/panel", "layout");
  redirect("/panel/mercancia");
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
  const ubicacion = String(formData.get("ubicacion") ?? "eeuu") === "cuba" ? "cuba" : "eeuu";
  const d = await db();
  const id = newId();
  await d
    .prepare("INSERT INTO purchases (id, fecha, nota, ubicacion) VALUES (?1,?2,?3,?4)")
    .bind(id, fecha, nota, ubicacion)
    .run();
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

/**
 * Confirma una importación que traía cantidades: da de alta el catálogo y, en
 * la misma pasada, registra la compra que mete esa mercancía en el almacén.
 *
 * Va junto a propósito. Importar una hoja con cantidades y que el almacén siga
 * a cero es lo que hizo que se asignara mercancía inexistente: el catálogo por
 * sí solo no es existencias. Las líneas llegan ya revisadas y editadas por el
 * distribuidor, no crudas del archivo.
 */
export async function confirmImportedPurchase(_prev: MutResult, formData: FormData): Promise<MutResult> {
  if (!(await requireAdmin())) return { error: "Sesión inválida." };
  const fecha = String(formData.get("fecha") ?? "").trim();
  const nota = String(formData.get("nota") ?? "").trim();
  const ubicacion = String(formData.get("ubicacion") ?? "eeuu") === "cuba" ? "cuba" : "eeuu";
  if (!fecha) return { error: "Falta la fecha de la compra." };

  let rows: {
    codigo?: string;
    nombre?: string;
    categoria?: string;
    costo?: number;
    precio?: number;
    cantidad?: number;
  }[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? ""));
  } catch {
    return { error: "Datos del archivo inválidos." };
  }
  const lineas = rows.filter((r) => String(r.nombre ?? "").trim() && (r.cantidad ?? 0) > 0);
  if (!lineas.length) return { error: "No hay ninguna línea con cantidad mayor que cero." };

  const d = await db();
  const existentes = await d
    .prepare("SELECT id, codigo, nombre FROM products")
    .all<{ id: string; codigo: string; nombre: string }>();
  const porCodigo = new Map<string, string>();
  const porNombre = new Map<string, string>();
  for (const p of existentes.results) {
    if (p.codigo) porCodigo.set(p.codigo.toLowerCase(), p.id);
    porNombre.set(p.nombre.toLowerCase(), p.id);
  }

  // Una misma hoja puede repetir un producto en varias filas; la clave de
  // purchase_items es (compra, producto), así que se suman antes de insertar.
  const porProducto = new Map<string, { cantidad: number; costo: number }>();
  let nuevos = 0;
  for (const r of lineas) {
    const nombre = String(r.nombre ?? "").trim();
    const codigo = String(r.codigo ?? "").trim();
    const costo = r.costo ?? 0;
    const precio = r.precio ?? 0;
    let id =
      (codigo ? porCodigo.get(codigo.toLowerCase()) : undefined) ?? porNombre.get(nombre.toLowerCase());
    if (id) {
      await d
        .prepare(
          "UPDATE products SET codigo = ?1, nombre = ?2, categoria = ?3, costo = ?4, precio = ?5 WHERE id = ?6",
        )
        .bind(codigo, nombre, String(r.categoria ?? "").trim(), costo, precio, id)
        .run();
    } else {
      id = newId();
      await d
        .prepare(
          "INSERT INTO products (id, codigo, nombre, categoria, costo, precio) VALUES (?1,?2,?3,?4,?5,?6)",
        )
        .bind(id, codigo, nombre, String(r.categoria ?? "").trim(), costo, precio)
        .run();
      if (codigo) porCodigo.set(codigo.toLowerCase(), id);
      porNombre.set(nombre.toLowerCase(), id);
      nuevos++;
    }
    const previo = porProducto.get(id);
    porProducto.set(id, {
      cantidad: (previo?.cantidad ?? 0) + (r.cantidad ?? 0),
      costo: costo || previo?.costo || 0,
    });
  }

  const compraId = newId();
  const stmts = [
    d
      .prepare("INSERT INTO purchases (id, fecha, nota, ubicacion) VALUES (?1,?2,?3,?4)")
      .bind(compraId, fecha, nota, ubicacion),
    ...[...porProducto.entries()].map(([productId, v]) =>
      d
        .prepare("INSERT INTO purchase_items (purchase_id, product_id, cantidad, costo) VALUES (?1,?2,?3,?4)")
        .bind(compraId, productId, v.cantidad, v.costo),
    ),
  ];
  await d.batch(stmts);

  revalidatePath("/panel", "layout");
  return { ok: true, count: porProducto.size, updated: nuevos };
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
  const snap = await loadSnapshot();
  const compra = snap.purchases.find((p) => p.id === id);
  if (!compra) return;

  // Borrar la compra retira esas unidades del almacén. Si ya salieron hacia los
  // vendedores, el stock quedaría en negativo: se avisa en vez de descuadrarlo.
  const enAlmacen = new Map(warehouseLines(snap).map((w) => [w.productId, w.almacen]));
  const nombreDe = new Map(snap.products.map((p) => [p.id, p.nombre]));
  for (const it of compra.items) {
    if ((enAlmacen.get(it.product_id) ?? 0) < it.cantidad) {
      redirect(`/panel/compras?error=${encodeURIComponent(nombreDe.get(it.product_id) ?? "?")}`);
    }
  }

  const d = await db();
  await d.batch([
    d.prepare("DELETE FROM purchase_items WHERE purchase_id = ?1").bind(id),
    d.prepare("DELETE FROM purchases WHERE id = ?1").bind(id),
  ]);
  revalidatePath("/panel", "layout");
  // Sin la ruta limpia, un aviso de un intento anterior seguiría en pantalla.
  redirect("/panel/compras");
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

  const snap = await loadSnapshot();

  // No se puede entregar lo que no hay. Se comprueban todas las líneas antes de
  // escribir nada: una asignación a medias dejaría al vendedor con mercancía
  // que el almacén no descontó.
  const stock = warehouseStock(snap);
  const nombreDe = new Map(snap.products.map((p) => [p.id, p.nombre]));
  const faltan = items
    .filter((it) => (stock.get(it.productId) ?? 0) < it.cantidad)
    .map(
      (it) =>
        `${nombreDe.get(it.productId) ?? "?"} (pides ${it.cantidad}, hay ${stock.get(it.productId) ?? 0})`,
    );
  if (faltan.length) {
    return { error: `No hay suficiente en el almacén: ${faltan.join("; ")}.` };
  }

  // Costo congelado: promedio ponderado de las compras del producto.
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
  // La página ya esconde el botón cuando hay ventas, pero el vendedor puede
  // reportar una entre que se pinta y se pulsa: hay que decir por qué no se borra.
  if ((sales?.n ?? 0) > 0) redirect("/panel/asignar?error=ventas");
  await d.batch([
    d.prepare("DELETE FROM assignment_items WHERE assignment_id = ?1").bind(id),
    d.prepare("DELETE FROM assignments WHERE id = ?1").bind(id),
  ]);
  revalidatePath("/panel", "layout");
  redirect("/panel/asignar");
}
