import Link from "next/link";

import { deleteAjuste, deleteRetiro } from "@/actions/negocio";
import { WarehouseAdjustForm } from "@/components/warehouse-adjust-form";
import { avgCosto, warehouseLines } from "@/lib/calculos";
import { money, qty, todayISO } from "@/lib/format";
import { loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function AlmacenPage() {
  const snap = await loadSnapshot();
  const wl = warehouseLines(snap).filter((w) => w.almacen > 0);
  const bySeller = new Map(snap.sellers.map((s) => [s.id, s.nombre]));

  const valorCosto = wl.reduce((s, w) => s + w.almacen * avgCosto(snap, w.productId), 0);
  const unidades = wl.reduce((s, w) => s + w.almacen, 0);

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
        <div className="tiles mt-4">
          <div className="glass tile">
            <div className="t-label">Valor en almacén</div>
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
