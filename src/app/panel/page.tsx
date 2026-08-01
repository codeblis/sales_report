import { MoneyBars } from "@/components/money-bars";
import {
  globalMetrics,
  lineStates,
  pendingSales,
  sellerAccount,
  sellerRanking,
  ventasPorDia,
} from "@/lib/calculos";
import { money, qty } from "@/lib/format";
import { loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

function daysAgoISO(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default async function DashboardPage() {
  const snap = await loadSnapshot();
  const g = globalMetrics(snap);
  const from30 = daysAgoISO(30);
  const serie = ventasPorDia(snap, from30);

  const hoy = daysAgoISO(0);
  const hoyMetrics = globalMetrics(snap, hoy, hoy);
  const pendienteCortar = snap.sales.filter((s) => !s.corte_id).reduce((s, v) => s + v.cantidad, 0);

  const lines = lineStates(snap);
  const agotados = [...lines.values()].filter((l) => l.asignado > 0 && l.enMano <= 0).length;
  const porCortar = snap.sellers
    .filter((s) => s.activo)
    .map((s) => ({ s, n: pendingSales(snap, s.id).length }))
    .filter((x) => x.n > 0);
  const deudores = snap.sellers
    .map((s) => ({ s, acct: sellerAccount(snap, s.id, [...lines.values()]) }))
    .filter((x) => x.acct.debe > 0);

  const ranking = sellerRanking(snap).slice(0, 10);

  return (
    <>
      <section className="glass hero" id="hero">
        <div className="hero-top">
          <div>
            <div className="hero-label">Ingresos por ventas</div>
            <div className="hero-fig">{money(g.ventasMonto)}</div>
            <div className="hero-sub">
              <b>{qty(g.unidadesVendidas)}</b> unidades vendidas · ganancia <b>{money(g.ganancia)}</b> · neta{" "}
              <b>{money(g.gananciaNeta)}</b>
            </div>
          </div>
          <div className="hero-date">
            <div className="dl">Cierre</div>
            <div className="dd">Acumulado</div>
          </div>
        </div>
      </section>

      <div className="tiles">
        {[
          ["Ventas de hoy", money(hoyMetrics.ventasMonto), `${qty(hoyMetrics.unidadesVendidas)} unidades`],
          ["Mercancía en almacén", money(g.almacenValorCosto), "valor a costo"],
          ["En manos de vendedores", money(g.enManoValorCosto), "valor a costo"],
          // Negativo = los vendedores abonaron por delante de sus cortes. No hay
          // nada que cobrar, así que se le da la vuelta al rótulo en vez de
          // enseñar "Por cobrar −$100".
          g.debeTotal < 0
            ? ["Pagado por delante", money(-g.debeTotal), "pagos − cortes"]
            : ["Por cobrar", money(g.debeTotal), "cortes − pagos"],
        ].map(([l, v, f]) => (
          <div key={l} className="glass tile">
            <div className="t-label">{l}</div>
            <div className="t-val">{v}</div>
            <div className="t-foot">{f}</div>
          </div>
        ))}
      </div>

      {pendienteCortar > 0 && (
        <p className="notice">
          Hay <b>{qty(pendienteCortar)}</b> unidades vendidas sin cortar en total.{" "}
          <a href="/panel/ventas" style={{ color: "inherit" }}>
            Ver ventas pendientes →
          </a>
        </p>
      )}

      {(porCortar.length > 0 || deudores.length > 0 || agotados > 0) && (
        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Atención</h3>
              <div className="sub">Lo que necesita tu decisión hoy</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-3">
            {porCortar.map(({ s, n }) => (
              <p key={s.id} className="notice" style={{ marginBottom: 0 }}>
                <b>{s.nombre}</b> tiene {n} venta{n > 1 ? "s" : ""} sin cortar.{" "}
                <a href={`/panel/vendedores/${s.id}`} style={{ color: "inherit" }}>
                  Hacer corte →
                </a>
              </p>
            ))}
            {deudores.map(({ s, acct }) => (
              <p key={s.id} className="notice" style={{ marginBottom: 0 }}>
                <b>{s.nombre}</b> debe <b>{money(acct.debe)}</b> (cortes − pagos).
              </p>
            ))}
            {agotados > 0 && (
              <p className="notice" style={{ marginBottom: 0 }}>
                <b>{qty(agotados)}</b> productos agotados en manos de vendedores: ya no les queda stock que
                vender.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Ventas · últimos 30 días</h3>
            <div className="sub">Ingresos por día</div>
          </div>
        </div>
        <div className="chart-wrap">
          <MoneyBars
            labels={serie.map((s) => s.fecha)}
            values={serie.map((s) => s.ventas)}
            units={serie.map((s) => s.unidades)}
            height={260}
          />
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Ranking de vendedores</h3>
            <div className="sub">Ventas, ganancia y estado de cuenta</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th className="num">Unidades</th>
                <th className="num">Ventas</th>
                <th className="num">Ganancia</th>
                <th className="num">Debe</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.sellerId}>
                  <td>
                    <a href={`/panel/vendedores/${r.sellerId}`} style={{ color: "inherit" }}>
                      {i + 1}. {r.vendedor}
                    </a>
                  </td>
                  <td className="num">{qty(r.unidades)}</td>
                  <td className="money">{money(r.ventas)}</td>
                  <td className="money">{money(r.ganancia)}</td>
                  <td className="money">{r.debe > 0 ? money(r.debe) : <span className="dim">—</span>}</td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={5}>
                    Todavía no hay ventas registradas.
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
