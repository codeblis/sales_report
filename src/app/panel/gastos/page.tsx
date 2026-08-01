import { deleteGasto } from "@/actions/negocio";
import { ExportBar } from "@/components/export-bar";
import { GastoForm } from "@/components/gasto-form";
import { globalMetrics } from "@/lib/calculos";
import { fmtDate, money, qty, todayISO } from "@/lib/format";
import { loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; categoria?: string }>;
}) {
  const { from, to, categoria } = await searchParams;
  const snap = await loadSnapshot();
  const g = globalMetrics(snap, from, to);

  const gastos = snap.gastos
    .filter((x) => (!from || x.fecha >= from) && (!to || x.fecha <= to))
    .filter((x) => !categoria || x.categoria === categoria)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));

  const total = gastos.reduce((s, x) => s + x.monto, 0);
  const categorias = [...new Set(snap.gastos.map((x) => x.categoria).filter(Boolean))].sort();

  const porCategoria = [
    ...gastos
      .reduce((m, x) => {
        const k = x.categoria || "Sin categoría";
        m.set(k, (m.get(k) ?? 0) + x.monto);
        return m;
      }, new Map<string, number>())
      .entries(),
  ]
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort((a, b) => b.monto - a.monto);

  const periodo = from || to ? `Del ${from || "inicio"} al ${to || "hoy"}` : "Todo el periodo";
  const gastosSheet = {
    name: "Gastos",
    head: ["Fecha", "Concepto", "Categoría", "Monto"],
    rows: gastos.map((x) => [x.fecha, x.concepto, x.categoria || "—", money(x.monto)]),
  };

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Gastos</h3>
            <div className="sub">Lo que sale del negocio y come la ganancia</div>
          </div>
          <form className="filters no-print" method="get">
            <input className="input" type="date" name="from" defaultValue={from} title="Desde" />
            <input className="input" type="date" name="to" defaultValue={to} title="Hasta" />
            <select className="select" name="categoria" defaultValue={categoria ?? ""} title="Categoría">
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
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
            <div className="t-label">Gastado en el periodo</div>
            <div className="t-val">{money(total)}</div>
            <div className="t-foot">{qty(gastos.length)} gastos</div>
          </div>
          <div className="glass tile">
            <div className="t-label">Ganancia de ventas</div>
            <div className="t-val">{money(g.ganancia)}</div>
            <div className="t-foot">antes de gastos</div>
          </div>
          <div className="glass tile">
            <div className="t-label">Ganancia neta</div>
            <div className="t-val">{money(g.gananciaNeta)}</div>
            <div className="t-foot">ganancia − gastos</div>
          </div>
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Movimientos</h3>
            <div className="sub">{periodo}</div>
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
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((x) => (
                <tr key={x.id}>
                  <td>{fmtDate(x.fecha)}</td>
                  <td>{x.concepto}</td>
                  <td>{x.categoria || <span className="dim">—</span>}</td>
                  <td className="num money">{money(x.monto)}</td>
                  <td className="no-print">
                    <form action={deleteGasto}>
                      <input type="hidden" name="id" value={x.id} />
                      <button className="btn btn-ghost btn-danger" type="submit" title="Eliminar gasto">
                        ×
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {gastos.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={5}>
                    No hay gastos en el periodo.
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
              <h3>Nuevo gasto</h3>
              <div className="sub">Se descuenta de la ganancia del periodo</div>
            </div>
          </div>
          <div className="mt-4">
            <GastoForm fechaDefault={todayISO()} categorias={categorias} />
          </div>
        </section>

        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Por categoría</h3>
              <div className="sub">Dónde se va el dinero</div>
            </div>
          </div>
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th className="num">Monto</th>
                </tr>
              </thead>
              <tbody>
                {porCategoria.map((c) => (
                  <tr key={c.nombre}>
                    <td>{c.nombre}</td>
                    <td className="num money">{money(c.monto)}</td>
                  </tr>
                ))}
                {porCategoria.length === 0 && (
                  <tr>
                    <td className="nodata" colSpan={2}>
                      Todavía no hay gastos registrados.
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
