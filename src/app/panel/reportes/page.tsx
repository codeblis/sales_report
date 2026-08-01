import { ExportBar } from "@/components/export-bar";
import { MoneyBars } from "@/components/money-bars";
import {
  avgCosto,
  globalMetrics,
  productReport,
  sellerRanking,
  ventasPorDia,
  warehouseLines,
} from "@/lib/calculos";
import { fmtDate, money, qty } from "@/lib/format";
import { loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const snap = await loadSnapshot();
  const g = globalMetrics(snap, from, to);
  const ranking = sellerRanking(snap, from, to);
  const serie = ventasPorDia(snap, from, to);
  const productos = productReport(snap);
  const almacen = warehouseLines(snap);
  const bySeller = new Map(snap.sellers.map((s) => [s.id, s.nombre]));
  const paidByCorte = new Map<string, number>();
  for (const p of snap.payments) {
    if (p.corte_id) paidByCorte.set(p.corte_id, (paidByCorte.get(p.corte_id) ?? 0) + p.monto);
  }
  const cuentas = snap.cortes
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      vendedor: bySeller.get(c.seller_id) ?? "?",
      importe: c.items.reduce((s, it) => s + it.cantidad * it.precio, 0),
      pagado: paidByCorte.get(c.id) ?? 0,
    }))
    .map((c) => ({ ...c, saldo: c.importe - c.pagado }))
    .filter((c) => c.saldo > 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const pagos = [...snap.payments]
    .filter((p) => (!from || p.fecha >= from) && (!to || p.fecha <= to))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const gastos = snap.gastos
    .filter((x) => (!from || x.fecha >= from) && (!to || x.fecha <= to))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const rankingSheet = {
    name: "Vendedores",
    head: ["Vendedor", "Unidades", "Ventas", "Ganancia", "Cobrado", "Debe"],
    rows: ranking.map((r) => [
      r.vendedor,
      qty(r.unidades),
      money(r.ventas),
      money(r.ganancia),
      money(r.cobrado),
      money(r.debe),
    ]),
  };
  const productoSheet = {
    name: "Mercancía",
    head: [
      "Código",
      "Producto",
      "Categoría",
      "Comprado",
      "Asignado",
      "Vendido uds",
      "Vendido",
      "En mano",
      "Almacén",
      "Ganancia",
    ],
    rows: productos.map((p) => [
      p.codigo,
      p.product,
      p.categoria,
      qty(p.comprado),
      qty(p.asignado),
      qty(p.vendidoUds),
      money(p.vendidoMonto),
      qty(p.enMano),
      qty(p.almacen),
      money(p.ganancia),
    ]),
  };
  const almacenSheet = {
    name: "Almacén",
    head: ["Producto", "Categoría", "En almacén", "Costo promedio", "Valor"],
    rows: almacen
      .filter((w) => w.almacen > 0)
      .map((w) => [
        w.product,
        w.categoria,
        qty(w.almacen),
        money(avgCosto(snap, w.productId)),
        money(w.almacen * avgCosto(snap, w.productId)),
      ]),
  };
  const cuentasSheet = {
    name: "Cuentas por cobrar",
    head: ["Fecha", "Vendedor", "Importe", "Pagado", "Saldo"],
    rows: cuentas.map((c) => [c.fecha, c.vendedor, money(c.importe), money(c.pagado), money(c.saldo)]),
  };
  const pagosSheet = {
    name: "Pagos",
    head: ["Fecha", "Vendedor", "Monto", "Nota"],
    rows: pagos.map((p) => [p.fecha, bySeller.get(p.seller_id) ?? "?", money(p.monto), p.nota ?? ""]),
  };
  const gastosSheet = {
    name: "Gastos",
    head: ["Fecha", "Concepto", "Categoría", "Monto"],
    rows: gastos.map((x) => [x.fecha, x.concepto, x.categoria || "—", money(x.monto)]),
  };
  const serieSheet = {
    name: "Ventas por día",
    head: ["Día", "Unidades", "Ventas", "Ganancia"],
    rows: serie.map((d) => [d.fecha, qty(d.unidades), money(d.ventas), money(d.ganancia)]),
  };

  const periodo = from || to ? `Del ${from || "inicio"} al ${to || "hoy"}` : "Todo el periodo";

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Reportes</h3>
            <div className="sub">{periodo}</div>
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
            <div className="tl">{money(g.ventasMonto)}</div>
            <div className="ts">ventas</div>
          </div>
          <div className="glass tile">
            <div className="tl">{money(g.ganancia)}</div>
            <div className="ts">ganancia</div>
          </div>
          <div className="glass tile">
            <div className="tl">{money(g.gastosMonto)}</div>
            <div className="ts">gastos</div>
          </div>
          <div className="glass tile">
            <div className="tl">{money(g.gananciaNeta)}</div>
            <div className="ts">ganancia neta</div>
          </div>
          <div className="glass tile">
            <div className="tl">{qty(g.unidadesVendidas)}</div>
            <div className="ts">unidades vendidas</div>
          </div>
          <div className="glass tile">
            <div className="tl">{money(g.debeTotal)}</div>
            <div className="ts">cuentas por cobrar</div>
          </div>
        </div>
        <div className="mt-4" style={{ height: 210 }}>
          <MoneyBars
            labels={serie.map((d) => d.fecha)}
            values={serie.map((d) => d.ventas)}
            units={serie.map((d) => d.unidades)}
          />
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Por vendedor</h3>
            <div className="sub">Ventas, ganancia y saldo del periodo</div>
          </div>
          <ExportBar
            name="vendedores"
            title="Reporte por vendedor"
            subtitle={periodo}
            sheets={[rankingSheet, serieSheet]}
          />
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th className="num">Unidades</th>
                <th className="num">Ventas</th>
                <th className="num">Ganancia</th>
                <th className="num">Cobrado</th>
                <th className="num">Debe</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.sellerId}>
                  <td>{r.vendedor}</td>
                  <td className="num">{qty(r.unidades)}</td>
                  <td className="num money">{money(r.ventas)}</td>
                  <td className="num">{money(r.ganancia)}</td>
                  <td className="num">{money(r.cobrado)}</td>
                  <td className="num">{money(r.debe)}</td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={6}>
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
            <h3>Mercancía</h3>
            <div className="sub">Comprado, asignado, vendido y existencias</div>
          </div>
          <ExportBar
            name="mercancia"
            title="Reporte de mercancía"
            subtitle={periodo}
            sheets={[productoSheet, almacenSheet]}
          />
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="num">Comprado</th>
                <th className="num">Asignado</th>
                <th className="num">Vendido</th>
                <th className="num">En mano</th>
                <th className="num">Almacén</th>
                <th className="num">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.productId}>
                  <td className="code">{p.codigo || "—"}</td>
                  <td>{p.product}</td>
                  <td>{p.categoria || "—"}</td>
                  <td className="num">{qty(p.comprado)}</td>
                  <td className="num">{qty(p.asignado)}</td>
                  <td className="num">{qty(p.vendidoUds)}</td>
                  <td className="num">{qty(p.enMano)}</td>
                  <td className="num">{qty(p.almacen)}</td>
                  <td className="num">{money(p.ganancia)}</td>
                </tr>
              ))}
              {productos.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={9}>
                    El catálogo está vacío.
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
              <h3>Cuentas por cobrar</h3>
              <div className="sub">Cortes con saldo pendiente</div>
            </div>
            <ExportBar
              name="cuentas"
              title="Cuentas por cobrar"
              subtitle="Pendientes"
              sheets={[cuentasSheet]}
            />
          </div>
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vendedor</th>
                  <th className="num">Importe</th>
                  <th className="num">Pagado</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id}>
                    <td>{fmtDate(c.fecha)}</td>
                    <td>{c.vendedor}</td>
                    <td className="num">{money(c.importe)}</td>
                    <td className="num">{money(c.pagado)}</td>
                    <td className="num money">{money(c.saldo)}</td>
                  </tr>
                ))}
                {cuentas.length === 0 && (
                  <tr>
                    <td className="nodata" colSpan={5}>
                      Todo está pagado.
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
              <h3>Pagos</h3>
              <div className="sub">Pagos registrados en el periodo</div>
            </div>
            <ExportBar name="pagos" title="Pagos recibidos" subtitle={periodo} sheets={[pagosSheet]} />
          </div>
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vendedor</th>
                  <th className="num">Monto</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.fecha)}</td>
                    <td>{bySeller.get(p.seller_id) ?? "?"}</td>
                    <td className="num money">{money(p.monto)}</td>
                    <td>{p.nota || <span className="dim">—</span>}</td>
                  </tr>
                ))}
                {pagos.length === 0 && (
                  <tr>
                    <td className="nodata" colSpan={4}>
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
              <h3>Gastos</h3>
              <div className="sub">Salidas del negocio en el periodo</div>
            </div>
            <ExportBar name="gastos" title="Gastos del negocio" subtitle={periodo} sheets={[gastosSheet]} />
          </div>
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th className="num">Monto</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((x) => (
                  <tr key={x.id}>
                    <td>{fmtDate(x.fecha)}</td>
                    <td>{x.concepto}</td>
                    <td>{x.categoria || <span className="dim">—</span>}</td>
                    <td className="num money">{money(x.monto)}</td>
                  </tr>
                ))}
                {gastos.length === 0 && (
                  <tr>
                    <td className="nodata" colSpan={4}>
                      No hay gastos en el periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
