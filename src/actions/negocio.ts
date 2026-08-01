"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/actions/admin";
import { db, newId } from "@/lib/db";
import type { AssignmentItem, Retiro, Sale } from "@/lib/types";

const D = (form: FormData, name: string): string => String(form.get(name) ?? "").trim();
const N = (form: FormData, name: string): number => {
  const v = parseFloat(String(form.get(name) ?? ""));
  return Number.isFinite(v) ? v : 0;
};

async function guard(): Promise<void> {
  if (!(await requireAdmin())) throw new Error("Sesión de administrador inválida.");
}

function reval(): void {
  revalidatePath("/panel", "layout");
}

/** Líneas de un vendedor con saldo, ordenadas por fecha (FIFO para cortes/recogidas). */
async function sellerLinesWithSaldo(sellerId: string) {
  const d = await db();
  const rows = await d
    .prepare(
      `SELECT ai.assignment_id, ai.product_id, ai.cantidad AS asignado, ai.precio, ai.costo,
              COALESCE(SUM(s.cantidad),0) AS vendido,
              COALESCE((SELECT SUM(ri.cantidad) FROM retiro_items ri WHERE ri.assignment_id = ai.assignment_id AND ri.product_id = ai.product_id),0) AS recogido,
              COALESCE((SELECT SUM(aji.cantidad) FROM ajuste_items aji WHERE aji.assignment_id = ai.assignment_id AND aji.product_id = ai.product_id),0) AS ajustado
       FROM assignment_items ai
       JOIN assignments a ON a.id = ai.assignment_id
       LEFT JOIN sales s ON s.assignment_id = ai.assignment_id AND s.product_id = ai.product_id
       WHERE a.seller_id = ?1
       GROUP BY ai.assignment_id, ai.product_id
       ORDER BY a.fecha, a.id`,
    )
    .bind(sellerId)
    .all<AssignmentItem & { asignado: number; vendido: number; recogido: number; ajustado: number }>();
  return rows.results.map((r) => ({
    ...r,
    enMano: Math.max(0, r.asignado - r.vendido - r.recogido - r.ajustado),
  }));
}

/* ============================================================
   VENTAS (admin: registro manual, correcciones)
   ============================================================ */

export async function createSale(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await guard();
  const sellerId = D(formData, "seller_id");
  const productId = D(formData, "product_id");
  const cantidad = N(formData, "cantidad");
  const fecha = D(formData, "fecha");
  if (!sellerId || !productId || cantidad <= 0 || !fecha) return { error: "Completa los datos de la venta." };
  // El producto puede venir de varias asignaciones: se reparte FIFO entre ellas.
  const lines = (await sellerLinesWithSaldo(sellerId)).filter(
    (l) => l.product_id === productId && l.enMano > 0,
  );
  const enMano = lines.reduce((s, l) => s + l.enMano, 0);
  if (enMano < cantidad) {
    return { error: `El vendedor solo tiene ${enMano} unidades de ese producto en mano.` };
  }
  const d = await db();
  const stmts: D1PreparedStatement[] = [];
  let rest = cantidad;
  for (const l of lines) {
    if (rest <= 0) break;
    const take = Math.min(l.enMano, rest);
    stmts.push(
      d
        .prepare("INSERT INTO sales (id, assignment_id, product_id, cantidad, fecha) VALUES (?1,?2,?3,?4,?5)")
        .bind(newId(), l.assignment_id, productId, take, fecha),
    );
    rest -= take;
  }
  await d.batch(stmts);
  reval();
  return { ok: true };
}

export async function deleteSale(formData: FormData): Promise<void> {
  await guard();
  const id = D(formData, "id");
  if (!id) return;
  const d = await db();
  await d.prepare("DELETE FROM sales WHERE id = ?1").bind(id).run();
  reval();
}

/* ============================================================
   CORTES
   ============================================================ */

type CorteItemInput = { productId: string; cantidad: number };

export async function createCorte(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await guard();
  const sellerId = D(formData, "seller_id");
  const fecha = D(formData, "fecha");
  const nota = D(formData, "nota");
  const items: CorteItemInput[] = [];
  for (const [key, value] of formData.entries()) {
    const m = /^qty_([^_]+)$/.exec(key);
    if (!m) continue;
    const cantidad = Number(value);
    if (Number.isFinite(cantidad) && cantidad > 0) items.push({ productId: m[1], cantidad });
  }
  if (!sellerId || !fecha) return { error: "Faltan datos del corte." };
  if (!items.length) return { error: "El corte no tiene productos." };

  const lines = await sellerLinesWithSaldo(sellerId);
  const d = await db();
  const corteId = newId();

  const pending = await d
    .prepare(
      `SELECT s.id, s.assignment_id, s.product_id, s.cantidad, s.fecha
       FROM sales s JOIN assignments a ON a.id = s.assignment_id
       WHERE a.seller_id = ?1 AND s.corte_id IS NULL
       ORDER BY s.fecha, s.id`,
    )
    .bind(sellerId)
    .all<Sale>();

  // Todo el corte se escribe en una sola transacción: un fallo a mitad dejaría
  // ventas cortadas contra un corte que no existe.
  const stmts: D1PreparedStatement[] = [
    d
      .prepare("INSERT INTO cortes (id, seller_id, fecha, nota) VALUES (?1,?2,?3,?4)")
      .bind(corteId, sellerId, fecha, nota),
  ];

  for (const item of items) {
    const line = lines.find((l) => l.product_id === item.productId);
    const precio = line?.precio ?? 0;
    const costo = line?.costo ?? 0;
    const productId = item.productId;
    stmts.push(
      d
        .prepare(
          "INSERT INTO corte_items (corte_id, product_id, cantidad, precio, costo) VALUES (?1,?2,?3,?4,?5)",
        )
        .bind(corteId, productId, item.cantidad, precio, costo),
    );

    // Marca ventas pendientes FIFO hasta cubrir la cantidad cortada.
    let rest = item.cantidad;
    for (const s of pending.results.filter((x) => x.product_id === productId)) {
      if (rest <= 0) break;
      const take = Math.min(s.cantidad, rest);
      if (take === s.cantidad) {
        stmts.push(d.prepare("UPDATE sales SET corte_id = ?1 WHERE id = ?2").bind(corteId, s.id));
      } else {
        // Cobertura parcial: parte la venta.
        stmts.push(
          d.prepare("UPDATE sales SET cantidad = cantidad - ?1 WHERE id = ?2").bind(take, s.id),
          d
            .prepare(
              "INSERT INTO sales (id, assignment_id, product_id, cantidad, fecha, corte_id) VALUES (?1,?2,?3,?4,?5,?6)",
            )
            .bind(newId(), s.assignment_id, productId, take, s.fecha, corteId),
        );
      }
      rest -= take;
    }
    // Lo cortado que no estaba reportado se registra como venta del corte.
    if (rest > 0 && line) {
      stmts.push(
        d
          .prepare(
            "INSERT INTO sales (id, assignment_id, product_id, cantidad, fecha, corte_id) VALUES (?1,?2,?3,?4,?5,?6)",
          )
          .bind(newId(), line.assignment_id, productId, rest, fecha, corteId),
      );
    }
  }

  await d.batch(stmts);
  reval();
  return { ok: true };
}

export async function deleteCorte(formData: FormData): Promise<void> {
  await guard();
  const id = D(formData, "id");
  if (!id) return;
  const d = await db();
  await d.prepare("DELETE FROM corte_items WHERE corte_id = ?1").bind(id).run();
  await d.prepare("UPDATE sales SET corte_id = NULL WHERE corte_id = ?1").bind(id).run();
  await d.prepare("DELETE FROM cortes WHERE id = ?1").bind(id).run();
  reval();
}

/* ============================================================
   PAGOS
   ============================================================ */

export async function createPayment(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await guard();
  const sellerId = D(formData, "seller_id");
  const monto = N(formData, "monto");
  const fecha = D(formData, "fecha");
  const corteId = D(formData, "corte_id") || null;
  const nota = D(formData, "nota");
  if (!sellerId || monto <= 0 || !fecha) return { error: "Completa monto y fecha del pago." };
  const d = await db();
  if (corteId) {
    const c = await d
      .prepare("SELECT id FROM cortes WHERE id = ?1 AND seller_id = ?2")
      .bind(corteId, sellerId)
      .first<{ id: string }>();
    if (!c) return { error: "El corte seleccionado no pertenece a este vendedor." };
  }
  await d
    .prepare("INSERT INTO payments (id, seller_id, corte_id, monto, fecha, nota) VALUES (?1,?2,?3,?4,?5,?6)")
    .bind(newId(), sellerId, corteId, monto, fecha, nota)
    .run();
  reval();
  return { ok: true };
}

export async function deletePayment(formData: FormData): Promise<void> {
  await guard();
  const id = D(formData, "id");
  if (!id) return;
  const d = await db();
  await d.prepare("DELETE FROM payments WHERE id = ?1").bind(id).run();
  reval();
}

/* ============================================================
   RECOGIDAS / TRASPASOS
   ============================================================ */

export async function createRetiro(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await guard();
  const sellerId = D(formData, "seller_id");
  const fecha = D(formData, "fecha");
  const destino = D(formData, "destino") || "almacen";
  const nota = D(formData, "nota");
  const items: { productId: string; cantidad: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const m = /^qty_([^_]+)$/.exec(key);
    if (!m) continue;
    const cantidad = Number(value);
    if (Number.isFinite(cantidad) && cantidad > 0) items.push({ productId: m[1], cantidad });
  }
  if (!sellerId || !fecha || !items.length) return { error: "Faltan datos de la recogida." };

  const lines = await sellerLinesWithSaldo(sellerId);
  const d = await db();

  // Se valida todo antes de escribir nada: una recogida a medias descuadraría
  // el stock del vendedor y el del almacén.
  if (destino !== "almacen") {
    const destSeller = await d
      .prepare("SELECT id FROM sellers WHERE id = ?1 AND activo = 1")
      .bind(destino)
      .first<{ id: string }>();
    if (!destSeller) return { error: "Vendedor destino inválido." };
    if (destino === sellerId) return { error: "El destino no puede ser el mismo vendedor." };
  }
  for (const item of items) {
    const enMano = lines.filter((l) => l.product_id === item.productId).reduce((s, l) => s + l.enMano, 0);
    if (enMano < item.cantidad) {
      return {
        error: `Solo se pueden recoger ${enMano} de ${item.cantidad} unidades del producto solicitado.`,
      };
    }
  }

  const retiroId = newId();
  const traspasoItems: { productId: string; cantidad: number; precio: number; costo: number }[] = [];
  const stmts: D1PreparedStatement[] = [
    d
      .prepare("INSERT INTO retiros (id, seller_id, fecha, destino, nota) VALUES (?1,?2,?3,?4,?5)")
      .bind(retiroId, sellerId, fecha, destino, nota),
  ];

  for (const item of items) {
    let rest = item.cantidad;
    for (const l of lines.filter((x) => x.product_id === item.productId && x.enMano > 0)) {
      if (rest <= 0) break;
      const take = Math.min(l.enMano, rest);
      stmts.push(
        d
          .prepare(
            "INSERT INTO retiro_items (retiro_id, assignment_id, product_id, cantidad) VALUES (?1,?2,?3,?4)",
          )
          .bind(retiroId, l.assignment_id, item.productId, take),
      );
      if (destino !== "almacen")
        traspasoItems.push({ productId: item.productId, cantidad: take, precio: l.precio, costo: l.costo });
      rest -= take;
    }
  }

  // Traspaso directo: la mercancía entra como asignación nueva al vendedor destino.
  // Reusamos el id de la recogida para poder revertirla después.
  if (destino !== "almacen") {
    stmts.push(
      d
        .prepare("INSERT INTO assignments (id, seller_id, fecha, nota) VALUES (?1,?2,?3,?4)")
        .bind(retiroId, destino, fecha, `Traspaso desde recogida${nota ? ` — ${nota}` : ""}`),
    );
    // Varias líneas de origen pueden dar el mismo producto: se suman en una
    // sola línea de la asignación destino, que lleva clave (asignación, producto).
    const porProducto = new Map<string, { cantidad: number; precio: number; costo: number }>();
    for (const t of traspasoItems) {
      const cur = porProducto.get(t.productId);
      if (cur) cur.cantidad += t.cantidad;
      else porProducto.set(t.productId, { cantidad: t.cantidad, precio: t.precio, costo: t.costo });
    }
    for (const [productId, t] of porProducto) {
      stmts.push(
        d
          .prepare(
            "INSERT INTO assignment_items (assignment_id, product_id, cantidad, precio, costo) VALUES (?1,?2,?3,?4,?5)",
          )
          .bind(retiroId, productId, t.cantidad, t.precio, t.costo),
      );
    }
  }

  await d.batch(stmts);
  reval();
  return { ok: true };
}

export async function deleteRetiro(formData: FormData): Promise<void> {
  await guard();
  const id = D(formData, "id");
  if (!id) return;
  const d = await db();
  const r = await d.prepare("SELECT * FROM retiros WHERE id = ?1").bind(id).first<Retiro>();
  if (!r) return;
  await d.prepare("DELETE FROM retiro_items WHERE retiro_id = ?1").bind(id).run();
  await d.prepare("DELETE FROM retiros WHERE id = ?1").bind(id).run();
  // Si era un traspaso, quita la asignación creada automáticamente (mismo id).
  if (r.destino !== "almacen") {
    await d.prepare("DELETE FROM assignment_items WHERE assignment_id = ?1").bind(id).run();
    await d.prepare("DELETE FROM assignments WHERE id = ?1").bind(id).run();
  }
  reval();
}

/* ============================================================
   AJUSTES (mermas / bajas)
   ============================================================ */

export async function createAjuste(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await guard();
  const fecha = D(formData, "fecha");
  const nota = D(formData, "nota");
  const sellerId = D(formData, "seller_id") || null;
  const items: { productId: string; cantidad: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const m = /^qty_([^_]+)$/.exec(key);
    if (!m) continue;
    const cantidad = Number(value);
    if (Number.isFinite(cantidad) && cantidad > 0) items.push({ productId: m[1], cantidad });
  }
  if (!fecha || !items.length) return { error: "Faltan datos del ajuste." };
  const d = await db();
  const lines = sellerId ? await sellerLinesWithSaldo(sellerId) : [];

  // Igual que en las recogidas: se comprueba todo antes de escribir, para no
  // dejar un ajuste con solo una parte de las bajas aplicadas.
  if (sellerId) {
    for (const item of items) {
      const enMano = lines.filter((l) => l.product_id === item.productId).reduce((s, l) => s + l.enMano, 0);
      if (enMano < item.cantidad) {
        return { error: "El vendedor no tiene suficiente mercancía en mano para ajustar." };
      }
    }
  }

  const ajusteId = newId();
  const stmts: D1PreparedStatement[] = [
    d
      .prepare("INSERT INTO ajustes (id, seller_id, fecha, nota) VALUES (?1,?2,?3,?4)")
      .bind(ajusteId, sellerId, fecha, nota),
  ];
  for (const item of items) {
    if (sellerId) {
      let rest = item.cantidad;
      for (const l of lines.filter((x) => x.product_id === item.productId && x.enMano > 0)) {
        if (rest <= 0) break;
        const take = Math.min(l.enMano, rest);
        stmts.push(
          d
            .prepare(
              "INSERT INTO ajuste_items (ajuste_id, assignment_id, product_id, cantidad) VALUES (?1,?2,?3,?4)",
            )
            .bind(ajusteId, l.assignment_id, item.productId, take),
        );
        rest -= take;
      }
    } else {
      stmts.push(
        d
          .prepare("INSERT INTO ajuste_items (ajuste_id, product_id, cantidad) VALUES (?1,?2,?3)")
          .bind(ajusteId, item.productId, item.cantidad),
      );
    }
  }
  await d.batch(stmts);
  reval();
  return { ok: true };
}

export async function deleteAjuste(formData: FormData): Promise<void> {
  await guard();
  const id = D(formData, "id");
  if (!id) return;
  const d = await db();
  await d.prepare("DELETE FROM ajuste_items WHERE ajuste_id = ?1").bind(id).run();
  await d.prepare("DELETE FROM ajustes WHERE id = ?1").bind(id).run();
  reval();
}

/* ============================================================
   GASTOS DEL NEGOCIO
   ============================================================ */

export async function createGasto(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await guard();
  const fecha = D(formData, "fecha");
  const concepto = D(formData, "concepto");
  const categoria = D(formData, "categoria");
  const monto = N(formData, "monto");
  if (!fecha || !concepto) return { error: "Escribe la fecha y el concepto del gasto." };
  if (monto <= 0) return { error: "El monto del gasto tiene que ser mayor que cero." };
  const d = await db();
  await d
    .prepare("INSERT INTO gastos (id, fecha, concepto, categoria, monto) VALUES (?1,?2,?3,?4,?5)")
    .bind(newId(), fecha, concepto, categoria, monto)
    .run();
  reval();
  return { ok: true };
}

export async function deleteGasto(formData: FormData): Promise<void> {
  await guard();
  const id = D(formData, "id");
  if (!id) return;
  const d = await db();
  await d.prepare("DELETE FROM gastos WHERE id = ?1").bind(id).run();
  reval();
}
