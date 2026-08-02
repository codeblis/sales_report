import { deleteRetiro } from "@/actions/negocio";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { money, qty } from "@/lib/format";
import { listSellers, loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function RecogidasPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const snap = await loadSnapshot();
  const sellers = await listSellers();
  const bySeller = new Map(sellers.map((s) => [s.id, s.nombre]));
  const byProduct = new Map(snap.products.map((p) => [p.id, p.nombre]));

  const retiros = snap.retiros
    .filter((r) => (!from || r.fecha >= from) && (!to || r.fecha <= to))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));

  const alAlmacen = retiros.filter((r) => r.destino === "almacen");
  const traspasos = retiros.filter((r) => r.destino !== "almacen");
  const unidadesDe = (rs: typeof retiros) =>
    rs.reduce((s, r) => s + r.items.reduce((x, i) => x + i.cantidad, 0), 0);

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Recogidas y traspasos</h3>
            <div className="sub">Mercancía devuelta al almacén o movida entre vendedores</div>
          </div>
          <form className="filters no-print" method="get">
            <input className="input" type="date" name="from" defaultValue={from} title="Desde" />
            <input className="input" type="date" name="to" defaultValue={to} title="Hasta" />
            <button className="btn btn-ghost" type="submit">
              Filtrar
            </button>
          </form>
        </div>
        <div className="tiles mt-4">
          <div className="glass tile">
            <div className="t-label">Recogidas al almacén</div>
            <div className="t-val">{qty(unidadesDe(alAlmacen))}</div>
            <div className="t-foot">{qty(alAlmacen.length)} movimientos</div>
          </div>
          <div className="glass tile">
            <div className="t-label">Traspasos entre vendedores</div>
            <div className="t-val">{qty(unidadesDe(traspasos))}</div>
            <div className="t-foot">{qty(traspasos.length)} movimientos</div>
          </div>
        </div>
        <div className="tscroll mt-4">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>De</th>
                <th>A</th>
                <th>Nota</th>
                <th className="num">Unidades</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {retiros.map((r) => (
                <tr key={r.id}>
                  <td>{r.fecha}</td>
                  <td>{bySeller.get(r.seller_id) ?? "?"}</td>
                  <td>
                    {r.destino === "almacen" ? (
                      <span className="chip">almacén</span>
                    ) : (
                      (bySeller.get(r.destino) ?? "?")
                    )}
                  </td>
                  <td>{r.nota || <span className="dim">—</span>}</td>
                  <td className="num">{qty(r.items.reduce((s, i) => s + i.cantidad, 0))}</td>
                  <td className="no-print">
                    <form action={deleteRetiro}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmit
                        title="Eliminar recogida"
                        titulo={`¿Eliminar la recogida del ${r.fecha}?`}
                        detalle={
                          <>
                            Son <b>{qty(r.items.reduce((s, i) => s + i.cantidad, 0))}</b> unidades de{" "}
                            <b>{bySeller.get(r.seller_id) ?? "?"}</b>. Volverán a contar como mercancía en su
                            poder.
                          </>
                        }
                      >
                        ×
                      </ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              ))}
              {retiros.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={6}>
                    No hay recogidas ni traspasos en el periodo.
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
            <h3>Detalle de productos</h3>
            <div className="sub">Cada movimiento con las unidades por producto</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Producto</th>
                <th className="num">Unidades</th>
                <th className="num">Valor a precio</th>
              </tr>
            </thead>
            <tbody>
              {retiros
                .flatMap((r) =>
                  r.items.map((i) => {
                    const ls = snap.assignments
                      .find((a) => a.id === i.assignment_id)
                      ?.items.find((x) => x.product_id === i.product_id);
                    return {
                      key: r.id + i.assignment_id + i.product_id,
                      fecha: r.fecha,
                      origen: bySeller.get(r.seller_id) ?? "?",
                      destino: r.destino === "almacen" ? "almacén" : (bySeller.get(r.destino) ?? "?"),
                      producto: byProduct.get(i.product_id) ?? "?",
                      cantidad: i.cantidad,
                      precio: ls?.precio ?? 0,
                    };
                  }),
                )
                .map((d) => (
                  <tr key={d.key}>
                    <td>{d.fecha}</td>
                    <td>
                      {d.origen} → <b>{d.destino}</b>
                    </td>
                    <td>{d.producto}</td>
                    <td className="num">{qty(d.cantidad)}</td>
                    <td className="money">{money(d.cantidad * d.precio)}</td>
                  </tr>
                ))}
              {retiros.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={5}>
                    Sin movimientos en el periodo.
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
