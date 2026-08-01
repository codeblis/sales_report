import Link from "next/link";
import { NewSellerForm } from "@/components/new-seller-form";
import { RenewPinButton } from "@/components/renew-pin-button";
import { lineStates, sellerAccount, sellerLines as sellerLinesOf, sellerTotals } from "@/lib/calculos";
import { fmtDate, money, qty } from "@/lib/format";
import { listSellers, loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function VendedoresPage() {
  const [sellers, snap] = await Promise.all([listSellers(), loadSnapshot()]);
  const lines = lineStates(snap);

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Vendedores</h3>
            <div className="sub">Cada uno reporta sus ventas con su enlace y PIN</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th className="num">En mano</th>
                <th className="num">Vendido</th>
                <th className="num">Debe</th>
                <th>Último acceso</th>
                <th>Estado</th>
                <th className="no-print">Acceso</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => {
                const sl = sellerLinesOf(snap, s.id, lines);
                const tot = sellerTotals(sl);
                const acct = sellerAccount(snap, s.id, sl);
                return (
                  <tr key={s.id} className={s.activo ? "" : "dim"}>
                    <td>
                      <Link href={`/panel/vendedores/${s.id}`} style={{ color: "inherit" }}>
                        {s.nombre}
                      </Link>
                      {s.telefono && <span className="tag">{s.telefono}</span>}
                    </td>
                    <td className="num">{qty(tot.enMano)}</td>
                    <td className="num">{qty(tot.unidadesVendidas)}</td>
                    <td className="money">{money(acct.debe)}</td>
                    <td>{s.last_login ? fmtDate(s.last_login) : <span className="dim">nunca entró</span>}</td>
                    <td>
                      {s.activo ? (
                        <span className="chip">activo</span>
                      ) : (
                        <span className="tag tag-danger">inactivo</span>
                      )}
                    </td>
                    <td className="no-print">
                      <RenewPinButton sellerId={s.id} compact />
                    </td>
                  </tr>
                );
              })}
              {sellers.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={7}>
                    Aún no hay vendedores. Crea el primero abajo.
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
            <h3>Nuevo vendedor</h3>
            <div className="sub">Se genera un PIN y un enlace para reportar ventas</div>
          </div>
        </div>
        <div className="mt-4">
          <NewSellerForm />
        </div>
      </section>
    </>
  );
}
