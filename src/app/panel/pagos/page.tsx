import { deletePayment } from "@/actions/negocio";
import { money, qty } from "@/lib/format";
import { listSellers, loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; seller?: string }>;
}) {
  const { from, to, seller } = await searchParams;
  const snap = await loadSnapshot();
  const sellers = await listSellers();
  const bySeller = new Map(sellers.map((s) => [s.id, s.nombre]));

  const pagos = snap.payments
    .filter((p) => (!from || p.fecha >= from) && (!to || p.fecha <= to))
    .filter((p) => !seller || p.seller_id === seller)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));

  const total = pagos.reduce((s, p) => s + p.monto, 0);

  const corteDe = new Map(snap.cortes.map((c) => [c.id, c.fecha]));
  const porVendedor = sellers
    .map((s) => {
      const totalCortado = snap.cortes
        .filter((c) => c.seller_id === s.id)
        .reduce((acc, c) => acc + c.items.reduce((x, i) => x + i.cantidad * i.precio, 0), 0);
      const totalPagado = snap.payments
        .filter((p) => p.seller_id === s.id)
        .reduce((acc, p) => acc + p.monto, 0);
      return {
        id: s.id,
        vendedor: s.nombre,
        cortado: totalCortado,
        pagado: totalPagado,
        saldo: totalCortado - totalPagado,
      };
    })
    .filter((x) => x.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo);

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Pagos</h3>
            <div className="sub">Dinero recibido de los vendedores</div>
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
            <div className="t-label">Recibido en el periodo</div>
            <div className="t-val">{money(total)}</div>
            <div className="t-foot">{qty(pagos.length)} pagos</div>
          </div>
          <div className="glass tile">
            <div className="t-label">Total por cobrar</div>
            <div className="t-val">{money(porVendedor.reduce((s, x) => s + x.saldo, 0))}</div>
            <div className="t-foot">{qty(porVendedor.length)} vendedores con saldo</div>
          </div>
        </div>
        <div className="tscroll mt-4">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th className="num">Monto</th>
                <th>Contra corte</th>
                <th>Nota</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id}>
                  <td>{p.fecha}</td>
                  <td>{bySeller.get(p.seller_id) ?? "?"}</td>
                  <td className="num money">{money(p.monto)}</td>
                  <td>
                    {p.corte_id ? (
                      <span className="chip">{corteDe.get(p.corte_id) ?? "?"}</span>
                    ) : (
                      <span className="tag">a cuenta</span>
                    )}
                  </td>
                  <td>{p.nota || <span className="dim">—</span>}</td>
                  <td className="no-print">
                    <form action={deletePayment}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn btn-ghost btn-danger" type="submit" title="Eliminar pago">
                        ×
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {pagos.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={6}>
                    No hay pagos en el periodo.
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
            <h3>Cuentas por vendedor</h3>
            <div className="sub">Cortado contra pagado: lo que te deben</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th className="num">Cortado</th>
                <th className="num">Pagado</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {porVendedor.map((x) => (
                <tr key={x.id}>
                  <td>{x.vendedor}</td>
                  <td className="num">{money(x.cortado)}</td>
                  <td className="num">{money(x.pagado)}</td>
                  <td className="num money">{money(x.saldo)}</td>
                </tr>
              ))}
              {porVendedor.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={4}>
                    Todo está pagado.
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
