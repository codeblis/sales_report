"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/actions/admin";
import { almacenStock, avgCosto } from "@/lib/calculos";
import { db, newId } from "@/lib/db";
import { loadSnapshot } from "@/lib/repo";

export type EnvioResult = { error?: string; ok?: boolean };

async function guard(): Promise<boolean> {
  return requireAdmin();
}

function reval(): void {
  revalidatePath("/panel", "layout");
}

/**
 * Despacha un envío: la mercancía sale del almacén de origen y queda en
 * tránsito hasta que se confirme su llegada.
 *
 * El destino es único —un paquete va a un sitio— y puede ser otro almacén o un
 * vendedor. Lo que se reparte después, ya en Cuba, son asignaciones y traspasos.
 */
export async function createEnvio(_prev: EnvioResult, formData: FormData): Promise<EnvioResult> {
  if (!(await guard())) return { error: "Sesión inválida." };

  const origenId = String(formData.get("origen_id") ?? "").trim();
  const destino = String(formData.get("destino") ?? "").trim(); // "almacen:<id>" | "vendedor:<id>"
  const fecha = String(formData.get("fecha") ?? "").trim();
  const costo = Number(formData.get("costo") ?? 0) || 0;
  const nota = String(formData.get("nota") ?? "").trim();

  const [destinoTipo, destinoId] = destino.split(":");
  if (!origenId || !fecha || (destinoTipo !== "almacen" && destinoTipo !== "vendedor") || !destinoId) {
    return { error: "Faltan datos del envío." };
  }
  if (destinoTipo === "almacen" && destinoId === origenId) {
    return { error: "El destino no puede ser el mismo almacén de origen." };
  }

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
  if (!items.length) return { error: "El envío no lleva ningún producto." };

  // Se comprueba todo antes de escribir: un envío a medias dejaría el almacén
  // de origen descontado sin que la mercancía viaje entera.
  const snap = await loadSnapshot();
  const stock = almacenStock(snap, origenId);
  const nombreDe = new Map(snap.products.map((p) => [p.id, p.nombre]));
  const faltan = items
    .filter((it) => (stock.get(it.productId) ?? 0) < it.cantidad)
    .map(
      (it) =>
        `${nombreDe.get(it.productId) ?? "?"} (envías ${it.cantidad}, hay ${stock.get(it.productId) ?? 0})`,
    );
  if (faltan.length) {
    return { error: `No hay suficiente en el almacén de origen: ${faltan.join("; ")}.` };
  }

  const d = await db();
  const id = newId();
  await d.batch([
    d
      .prepare(
        "INSERT INTO envios (id, fecha, origen_id, destino_tipo, destino_id, costo, nota, estado) VALUES (?1,?2,?3,?4,?5,?6,?7,'transito')",
      )
      .bind(id, fecha, origenId, destinoTipo, destinoId, costo, nota),
    ...items.map((it) =>
      d
        .prepare("INSERT INTO envio_items (envio_id, product_id, cantidad, precio) VALUES (?1,?2,?3,?4)")
        .bind(id, it.productId, it.cantidad, it.precio),
    ),
  ]);
  reval();
  return { ok: true };
}

/**
 * Confirma que un envío llegó.
 *
 * Si iba a un vendedor se le crea la asignación en ese momento, que es cuando
 * de verdad tiene la mercancía en la mano. Esa asignación se guarda **sin
 * almacén de origen a propósito**: la salida ya la descontó el envío al
 * despacharse, y volver a descontarla aquí contaría dos veces las mismas
 * unidades.
 */
export async function receiveEnvio(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") ?? "");
  const fechaLlegada = String(formData.get("fecha_llegada") ?? "").trim();
  if (!id) return;

  const d = await db();
  const envio = await d
    .prepare("SELECT id, destino_tipo, destino_id, estado, fecha FROM envios WHERE id = ?1")
    .bind(id)
    .first<{ id: string; destino_tipo: string; destino_id: string; estado: string; fecha: string }>();
  if (!envio || envio.estado === "recibido") return;

  const items = await d
    .prepare("SELECT product_id, cantidad, precio FROM envio_items WHERE envio_id = ?1")
    .bind(id)
    .all<{ product_id: string; cantidad: number; precio: number }>();

  const llegada = fechaLlegada || envio.fecha;
  const stmts = [
    d.prepare("UPDATE envios SET estado = 'recibido', fecha_llegada = ?1 WHERE id = ?2").bind(llegada, id),
  ];

  if (envio.destino_tipo === "vendedor") {
    const snap = await loadSnapshot();
    const asignacionId = newId();
    stmts.push(
      d
        .prepare(
          "INSERT INTO assignments (id, seller_id, fecha, nota, costo_distribucion, almacen_id) VALUES (?1,?2,?3,?4,0,NULL)",
        )
        .bind(asignacionId, envio.destino_id, llegada, `Llegada del envío ${id.slice(0, 8)}`),
      ...items.results.map((it) =>
        d
          .prepare(
            "INSERT INTO assignment_items (assignment_id, product_id, cantidad, precio, costo) VALUES (?1,?2,?3,?4,?5)",
          )
          .bind(asignacionId, it.product_id, it.cantidad, it.precio, avgCosto(snap, it.product_id)),
      ),
    );
  }

  await d.batch(stmts);
  reval();
}

/** Borra un envío. Si ya se recibió, primero hay que deshacer su llegada. */
export async function deleteEnvio(formData: FormData): Promise<void> {
  if (!(await guard())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const d = await db();
  const envio = await d
    .prepare("SELECT estado FROM envios WHERE id = ?1")
    .bind(id)
    .first<{ estado: string }>();
  if (!envio || envio.estado === "recibido") return;
  await d.batch([
    d.prepare("DELETE FROM envio_items WHERE envio_id = ?1").bind(id),
    d.prepare("DELETE FROM envios WHERE id = ?1").bind(id),
  ]);
  reval();
}
