import { deleteSale } from "@/actions/negocio";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { lineStates, pendingSales } from "@/lib/calculos";
import { money, qty } from "@/lib/format";
import { listSellers, loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; seller?: string }>;
}) {
  const { from, to, seller } = await searchParams;
  const [snap, sellers] = await Promise.all([loadSnapshot(), listSellers()]);
  const states = lineStates(snap);
  const bySeller = new Map(sellers.map((s) => [s.id, s.nombre]));
  const byProduct = new Map(snap.products.map((p) => [p.id, p.nombre]));
  const assignSeller = new Map(snap.assignments.map((a) => [a.id, a.seller_id]));

  const ventas = [...snap.sales]
    .filter((s) => (!from || s.fecha >= from) && (!to || s.fecha <= to))
    .filter((s) => !seller || assignSeller.get(s.assignment_id) === seller)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));

  const totalMonto = ventas.reduce((acc, s) => {
    const ls = states.get(`${s.assignment_id}|${s.product_id}`);
    return acc + s.cantidad * (ls?.precio ?? 0);
  }, 0);
  const totalUnidades = ventas.reduce((acc, s) => acc + s.cantidad, 0);
  const porCortar = sellers
    .filter((s) => s.activo)
    .map((s) => ({
      vendedor: s.nombre,
      cantidad: pendingSales(snap, s.id).reduce((acc, v) => acc + v.cantidad, 0),
    }))
    .filter((x) => x.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Ventas</h3>
            <div className="sub">Todas las ventas registradas, por el vendedor o por ti</div>
          </div>
          <form className="filters no-print" method="get">
            <input className="input" type="date" name="from" defaultValue={from} title="Desde" />
            <input className="input" type="date" name="to" defaultValue={to} title="Hasta" />
            <select className="select" name="seller" defaultValue={seller ?? ""} title="Vendedor">
              <option value="">Todos los vendedores</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost" type="submit">
              Filtrar
            </button>
          </form>
        </div>
        <div className="tiles mt-4">
          <div className="glass tile">
            <div className="t-label">Ventas del filtro</div>
            <div className="t-val">{money(totalMonto)}</div>
            <div className="t-foot">{qty(ventas.length)} ventas</div>
          </div>
          <div className="glass tile">
            <div className="t-label">Unidades</div>
            <div className="t-val">{qty(totalUnidades)}</div>
            <div className="t-foot">en {qty(ventas.length)} registros</div>
          </div>
        </div>
        <div className="tscroll mt-4">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>Producto</th>
                <th className="num">Cantidad</th>
                <th className="num">Precio</th>
                <th className="num">Importe</th>
                <th>Corte</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => {
                const ls = states.get(`${v.assignment_id}|${v.product_id}`);
                return (
                  <tr key={v.id}>
                    <td>{v.fecha}</td>
                    <td>{bySeller.get(assignSeller.get(v.assignment_id) ?? "") ?? "?"}</td>
                    <td>{byProduct.get(v.product_id) ?? "?"}</td>
                    <td className="num">{qty(v.cantidad)}</td>
                    <td className="money">{money(ls?.precio ?? 0)}</td>
                    <td className="money">{money((ls?.precio ?? 0) * v.cantidad)}</td>
                    <td>
                      {v.corte_id ? (
                        <span className="chip">cortada</span>
                      ) : (
                        <span className="tag">pendiente</span>
                      )}
                    </td>
                    <td className="no-print">
                      {!v.corte_id && (
                        <form action={deleteSale}>
                          <input type="hidden" name="id" value={v.id} />
                          <ConfirmSubmit
                            title="Eliminar venta"
                            titulo="¿Eliminar esta venta?"
                            detalle={
                              <>
                                <b>{qty(v.cantidad)}</b> uds de <b>{byProduct.get(v.product_id) ?? "?"}</b>{" "}
                                del {v.fecha}. La mercancía vuelve a contar en manos del vendedor.
                              </>
                            }
                          >
                            ×
                          </ConfirmSubmit>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {ventas.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={8}>
                    No hay ventas en el periodo.
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
            <h3>Ventas sin cortar</h3>
            <div className="sub">Reportadas por los vendedores y aún no liquidadas</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th className="num">Unidades pendientes</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {porCortar.map((p) => (
                <tr key={p.vendedor}>
                  <td>{p.vendedor}</td>
                  <td className="num">{qty(p.cantidad)}</td>
                  <td className="no-print">
                    <a
                      className="btn btn-ghost"
                      href={`/panel/vendedores/${sellers.find((s) => s.nombre === p.vendedor)?.id}`}
                    >
                      Hacer corte →
                    </a>
                  </td>
                </tr>
              ))}
              {porCortar.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={3}>
                    Todo está cortado al día.
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
