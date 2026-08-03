import Link from "next/link";

import { deleteAjuste, deleteRetiro } from "@/actions/negocio";
import { WarehouseAdjustForm } from "@/components/warehouse-adjust-form";
import { almacenStock, avgCosto, stockEnTransito, warehouseLines } from "@/lib/calculos";
import { money, qty, todayISO } from "@/lib/format";
import { loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function AlmacenPage() {
  const snap = await loadSnapshot();
  const todas = warehouseLines(snap);
  const wl = todas.filter((w) => w.almacen > 0);
  // Existencias imposibles: se entregó más de lo comprado. Antes quedaban fuera
  // del filtro de arriba y no se veían en ninguna parte.
  const descuadres = todas.filter((w) => w.almacen < 0);
  const bySeller = new Map(snap.sellers.map((s) => [s.id, s.nombre]));

  const valorCosto = wl.reduce((s, w) => s + w.almacen * avgCosto(snap, w.productId), 0);
  const unidades = wl.reduce((s, w) => s + w.almacen, 0);

  // Dónde está de verdad cada unidad: por almacén, y lo que va embarcado.
  const porAlmacen = snap.almacenes
    .filter((a) => a.activo)
    .map((a) => {
      const stock = almacenStock(snap, a.id);
      return {
        ...a,
        unidades: [...stock.values()].reduce((s, n) => s + n, 0),
        valor: [...stock.entries()].reduce((s, [id, n]) => s + n * avgCosto(snap, id), 0),
      };
    });
  const transito = stockEnTransito(snap);
  const unidadesTransito = [...transito.values()].reduce((s, n) => s + n, 0);

  type Row = {
    key: string;
    fecha: string;
    tipo: string;
    detalle: string;
    unidades: number;
    monto?: number;
    borrable?: "retiro" | "ajuste";
    id: string;
  };
  const rows: Row[] = [];

  for (const p of snap.purchases) {
    rows.push({
      key: `compra${p.id}`,
      fecha: p.fecha,
      tipo: "entrada",
      detalle: `Compra${p.nota ? ` — ${p.nota}` : ""}`,
      unidades: p.items.reduce((s, i) => s + i.cantidad, 0),
      monto: p.items.reduce((s, i) => s + i.cantidad * i.costo, 0),
      id: p.id,
    });
  }
  for (const a of snap.assignments) {
    rows.push({
      key: `asignacion${a.id}`,
      fecha: a.fecha,
      tipo: "salida",
      detalle: `Asignación a ${bySeller.get(a.seller_id) ?? "?"}`,
      unidades: a.items.reduce((s, i) => s + i.cantidad, 0),
      monto: a.items.reduce((s, i) => s + i.cantidad * i.precio, 0),
      id: a.id,
    });
  }
  for (const r of snap.retiros) {
    const unidadesRetiradas = r.items.reduce((s, i) => s + i.cantidad, 0);
    rows.push({
      key: `retiro${r.id}`,
      fecha: r.fecha,
      tipo: r.destino === "almacen" ? "entrada" : "traspaso",
      detalle:
        r.destino === "almacen"
          ? `Recogida de ${bySeller.get(r.seller_id) ?? "?"}`
          : `Traspaso de ${bySeller.get(r.seller_id) ?? "?"} a ${bySeller.get(r.destino) ?? "?"}`,
      unidades: unidadesRetiradas,
      borrable: "retiro",
      id: r.id,
    });
  }
  for (const a of snap.ajustes) {
    if (a.seller_id !== null) continue;
    rows.push({
      key: `ajuste${a.id}`,
      fecha: a.fecha,
      tipo: "salida",
      detalle: `Merma en almacén${a.nota ? ` — ${a.nota}` : ""}`,
      unidades: a.items.reduce((s, i) => s + i.cantidad, 0),
      borrable: "ajuste",
      id: a.id,
    });
  }
  rows.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.key.localeCompare(a.key));

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Almacén</h3>
            <div className="sub">Existencias a costo promedio, sin contar lo asignado</div>
          </div>
        </div>
        {descuadres.length > 0 && (
          <p className="notice" role="alert">
            <b>Hay existencias en negativo.</b> Se entregó a los vendedores más mercancía de la que se había
            comprado:{" "}
            {descuadres.map((w, i) => (
              <span key={w.productId}>
                {i > 0 ? ", " : ""}
                <b>{w.product}</b> ({qty(w.almacen)})
              </span>
            ))}
            . Cuadra registrando la compra que falta, o eliminando la asignación de más desde{" "}
            <Link href="/panel/asignar" style={{ color: "inherit" }}>
              Asignar
            </Link>
            . De aquí en adelante la app ya no deja asignar por encima del stock.
          </p>
        )}
        <div className="tiles mt-4">
          {porAlmacen.map((a) => (
            <div key={a.id} className="glass tile">
              <div className="t-label">{a.nombre}</div>
              <div className="t-val">{qty(a.unidades)}</div>
              <div className="t-foot">{money(a.valor)} a costo</div>
            </div>
          ))}
          {unidadesTransito > 0 && (
            <div className="glass tile">
              <div className="t-label">En camino a Cuba</div>
              <div className="t-val">{qty(unidadesTransito)}</div>
              <div className="t-foot">despachado, sin llegar</div>
            </div>
          )}
          <div className="glass tile">
            <div className="t-label">Valor total</div>
            <div className="t-val">{money(valorCosto)}</div>
            <div className="t-foot">a costo de compra</div>
          </div>
          <div className="glass tile">
            <div className="t-label">Unidades</div>
            <div className="t-val">{qty(unidades)}</div>
            <div className="t-foot">{qty(wl.length)} productos distintos</div>
          </div>
        </div>
        <div className="tscroll mt-4">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="num">Unidades</th>
                <th className="num">Costo promedio</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {wl.map((w) => (
                <tr key={w.productId}>
                  <td className="code">{w.codigo || "—"}</td>
                  <td>{w.product}</td>
                  <td>{w.categoria || <span className="dim">—</span>}</td>
                  <td className="num">{qty(w.almacen)}</td>
                  <td className="money">{money(avgCosto(snap, w.productId))}</td>
                  <td className="money">{money(w.almacen * avgCosto(snap, w.productId))}</td>
                </tr>
              ))}
              {wl.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={6}>
                    El almacén está vacío. Registra compras para empezar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Ajuste de almacén</h3>
              <div className="sub">Merma, pérdida o corrección del inventario</div>
            </div>
          </div>
          <div className="mt-4">
            <WarehouseAdjustForm
              lines={wl.map((w) => ({ productId: w.productId, product: w.product, almacen: w.almacen }))}
              fechaDefault={todayISO()}
            />
          </div>
        </section>

        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Resumen por producto</h3>
              <div className="sub">Entradas y salidas del periodo</div>
            </div>
          </div>
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Comprado</th>
                  <th className="num">Asignado</th>
                  <th className="num">Recogido</th>
                  <th className="num">En almacén</th>
                </tr>
              </thead>
              <tbody>
                {warehouseLines(snap)
                  .filter((w) => w.comprado > 0)
                  .map((w) => (
                    <tr key={w.productId}>
                      <td>
                        <Link href="/panel/mercancia" style={{ color: "inherit" }}>
                          {w.product}
                        </Link>
                      </td>
                      <td className="num">{qty(w.comprado)}</td>
                      <td className="num">{qty(w.asignado)}</td>
                      <td className="num">{qty(w.comprado - w.asignado - w.almacen)}</td>
                      <td className="num">
                        <b>{qty(w.almacen)}</b>
                      </td>
                    </tr>
                  ))}
                {warehouseLines(snap).filter((w) => w.comprado > 0).length === 0 && (
                  <tr>
                    <td className="nodata" colSpan={5}>
                      Sin compras todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Movimientos del almacén</h3>
            <div className="sub">Compras, asignaciones, recogidas y mermas</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th className="num">Unidades</th>
                <th className="num">Monto</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.fecha}</td>
                  <td>
                    <span className={r.tipo === "entrada" ? "chip" : "tag"}>{r.tipo}</span>
                  </td>
                  <td>{r.detalle}</td>
                  <td className="num">{qty(r.unidades)}</td>
                  <td className="money">{r.monto != null ? money(r.monto) : "—"}</td>
                  <td className="no-print">
                    {r.borrable && (
                      <form action={r.borrable === "retiro" ? deleteRetiro : deleteAjuste}>
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          className="btn btn-ghost btn-danger"
                          type="submit"
                          title={`Eliminar ${r.borrable === "retiro" ? "recogida" : "ajuste"}`}
                        >
                          ×
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={6}>
                    Sin movimientos todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
