import { deleteEnvio, receiveEnvio } from "@/actions/envios";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EnvioForm } from "@/components/envio-form";
import { almacenStock } from "@/lib/calculos";
import { fmtDate, money, qty, todayISO } from "@/lib/format";
import { loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function EnviosPage() {
  const snap = await loadSnapshot();
  const almacenes = snap.almacenes.filter((a) => a.activo);
  const bySeller = new Map(snap.sellers.map((s) => [s.id, s.nombre]));
  const byAlmacen = new Map(snap.almacenes.map((a) => [a.id, a.nombre]));
  const byProduct = new Map(snap.products.map((p) => [p.id, p]));

  // Lo que se puede despachar desde cada almacén, ya descontado lo que va en camino.
  const productosPorAlmacen: Record<
    string,
    { id: string; nombre: string; precio: number; disponible: number }[]
  > = {};
  for (const a of almacenes) {
    const stock = almacenStock(snap, a.id);
    productosPorAlmacen[a.id] = [...stock.entries()]
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({
        id,
        nombre: byProduct.get(id)?.nombre ?? "?",
        precio: byProduct.get(id)?.precio ?? 0,
        disponible: n,
      }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre));
  }

  const envios = [...snap.envios].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  const enCamino = envios.filter((e) => e.estado === "transito");
  const unidadesEnCamino = enCamino.reduce((s, e) => s + e.items.reduce((n, i) => n + i.cantidad, 0), 0);
  const costoTotal = envios.reduce((s, e) => s + e.costo, 0);

  const destinoDe = (e: (typeof envios)[number]) =>
    e.destino_tipo === "almacen"
      ? (byAlmacen.get(e.destino_id) ?? "?")
      : `${bySeller.get(e.destino_id) ?? "?"} (directo)`;

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Envíos</h3>
            <div className="sub">De Estados Unidos a Cuba, y entre almacenes</div>
          </div>
        </div>
        <div className="tiles mt-4">
          <div className="glass tile">
            <div className="t-label">En camino</div>
            <div className="t-val">{qty(unidadesEnCamino)}</div>
            <div className="t-foot">
              {qty(enCamino.length)} {enCamino.length === 1 ? "envío" : "envíos"} sin llegar
            </div>
          </div>
          <div className="glass tile">
            <div className="t-label">Costo de envíos</div>
            <div className="t-val">{money(costoTotal)}</div>
            <div className="t-foot">se resta de la ganancia</div>
          </div>
        </div>

        <div className="tscroll mt-4">
          <table>
            <thead>
              <tr>
                <th>Salida</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th className="num">Unidades</th>
                <th className="num">Costo</th>
                <th>Estado</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {envios.map((e) => {
                const unidades = e.items.reduce((s, i) => s + i.cantidad, 0);
                return (
                  <tr key={e.id}>
                    <td>{fmtDate(e.fecha)}</td>
                    <td>{byAlmacen.get(e.origen_id) ?? "?"}</td>
                    <td>{destinoDe(e)}</td>
                    <td className="num">{qty(unidades)}</td>
                    <td className="money">{money(e.costo)}</td>
                    <td>
                      {e.estado === "recibido" ? (
                        <span className="chip">llegó {e.fecha_llegada ? fmtDate(e.fecha_llegada) : ""}</span>
                      ) : (
                        <span className="tag">en camino</span>
                      )}
                    </td>
                    <td className="no-print">
                      {e.estado === "transito" && (
                        <div className="flex items-center gap-1">
                          <form action={receiveEnvio}>
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="fecha_llegada" value={todayISO()} />
                            <ConfirmSubmit
                              className="btn btn-ghost"
                              titulo="¿Confirmar que llegó?"
                              detalle={
                                e.destino_tipo === "vendedor" ? (
                                  <>
                                    Las <b>{qty(unidades)}</b> unidades pasan a manos de{" "}
                                    <b>{bySeller.get(e.destino_id) ?? "?"}</b>, que ya podrá reportar ventas.
                                  </>
                                ) : (
                                  <>
                                    Las <b>{qty(unidades)}</b> unidades entran en{" "}
                                    <b>{byAlmacen.get(e.destino_id) ?? "?"}</b> y podrás repartirlas.
                                  </>
                                )
                              }
                              confirmar="Sí, llegó"
                              peligro={false}
                            >
                              Marcar llegada
                            </ConfirmSubmit>
                          </form>
                          <form action={deleteEnvio}>
                            <input type="hidden" name="id" value={e.id} />
                            <ConfirmSubmit
                              title="Eliminar envío"
                              titulo="¿Eliminar este envío?"
                              detalle="La mercancía vuelve al almacén de origen. Solo se puede mientras no haya llegado."
                            >
                              ×
                            </ConfirmSubmit>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {envios.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={7}>
                    Todavía no hay envíos. Despacha el primero abajo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Despachar envío</h3>
            <div className="sub">Un paquete, un destino: otro almacén o un vendedor</div>
          </div>
        </div>
        <div className="mt-4">
          <EnvioForm
            almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre, pais: a.pais }))}
            vendedores={snap.sellers.filter((s) => s.activo).map((s) => ({ id: s.id, nombre: s.nombre }))}
            productosPorAlmacen={productosPorAlmacen}
            fechaDefault={todayISO()}
          />
        </div>
      </section>
    </>
  );
}
