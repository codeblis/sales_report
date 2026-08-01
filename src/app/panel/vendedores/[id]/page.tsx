import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { deleteCorte, deleteSale } from "@/actions/negocio";
import { deleteSeller } from "@/actions/sellers";
import { CorteForm } from "@/components/corte-form";
import { RenewPinButton } from "@/components/renew-pin-button";
import { AjusteForm, PaymentForm, RetiroForm, SaleForm, SellerEditForm } from "@/components/seller-forms";
import {
  lineStates,
  pendingCorteItems,
  sellerAccount,
  sellerCortes,
  sellerLines as sellerLinesOf,
  sellerMovements,
  sellerTotals,
} from "@/lib/calculos";
import { money, qty, todayISO } from "@/lib/format";
import { getSeller, loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function VendedorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [seller, snap] = await Promise.all([getSeller(id), loadSnapshot()]);
  if (!seller) notFound();

  // Solo se puede borrar un vendedor sin historial: el que ya operó se desactiva.
  const historial =
    snap.assignments.filter((a) => a.seller_id === id).length +
    snap.cortes.filter((c) => c.seller_id === id).length +
    snap.payments.filter((p) => p.seller_id === id).length +
    snap.retiros.filter((r) => r.seller_id === id).length +
    snap.ajustes.filter((a) => a.seller_id === id).length;

  const lines = lineStates(snap);
  const sl = sellerLinesOf(snap, id, lines);
  const tot = sellerTotals(sl);
  const acct = sellerAccount(snap, id, sl);
  const cortes = sellerCortes(snap, id);
  const pending = pendingCorteItems(snap, id, lines);
  const movs = sellerMovements(snap, id, lines);

  const conStock = sl.filter((l) => l.enMano > 0);
  const lineOptions = conStock.map((l) => ({
    productId: l.productId,
    product: l.product,
    enMano: l.enMano,
    precio: l.precio,
  }));
  const destinos = snap.sellers.filter((s) => s.id !== id && s.activo);
  const fechaDefault = todayISO();
  const h = await headers();
  const base =
    (h.get("x-forwarded-proto") ?? "https") +
    "://" +
    (h.get("x-forwarded-host") ?? h.get("host") ?? "reportes-ventas.pages.dev");

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>
              {seller.nombre}
              {!seller.activo && <span className="tag tag-danger">inactivo</span>}
            </h3>
            <div className="sub">
              {seller.telefono || "Sin teléfono"} · {qty(tot.enMano)} unidades en mano · debe{" "}
              {money(acct.debe)}
            </div>
          </div>
        </div>

        <div className="tiles mt-4">
          {[
            ["En mano", `${qty(tot.enMano)} uds`, `${money(tot.enManoValor)} a precio venta`],
            ["Vendido", `${qty(tot.unidadesVendidas)} uds`, money(tot.vendidoMonto)],
            ["Ganancia para ti", money(tot.ganancia), "precio − costo"],
            ["Debe", money(acct.debe), `${qty(acct.cortesPendientes)} cortes con saldo`],
          ].map(([l, v, f]) => (
            <div key={l} className="glass tile">
              <div className="t-label">{l}</div>
              <div className="t-val">{v}</div>
              <div className="t-foot">{f}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Mercancía en mano</h3>
            <div className="sub">Asignado − vendido − recogido − ajustado</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Asignado</th>
                <th className="num">Vendido</th>
                <th className="num">Recogido</th>
                <th className="num">En mano</th>
                <th className="num">Precio</th>
              </tr>
            </thead>
            <tbody>
              {sl.map((l) => (
                <tr key={l.assignmentId + l.productId}>
                  <td>
                    {l.product}
                    {l.enMano <= 0 && <span className="tag">agotado</span>}
                  </td>
                  <td className="num">{qty(l.asignado)}</td>
                  <td className="num">{qty(l.vendido)}</td>
                  <td className="num">{qty(l.recogido)}</td>
                  <td className="num">
                    <b>{qty(l.enMano)}</b>
                  </td>
                  <td className="money">{money(l.precio)}</td>
                </tr>
              ))}
              {sl.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={6}>
                    Este vendedor no tiene mercancía asignada todavía.
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
            <h3>Nuevo corte de venta</h3>
            <div className="sub">Liquida lo vendido; la mercancía restante sigue con el vendedor</div>
          </div>
        </div>
        <div className="mt-4">
          <CorteForm sellerId={id} pending={pending} fechaDefault={fechaDefault} />
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Cortes</h3>
            <div className="sub">Historial de liquidaciones</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="num">Importe</th>
                <th className="num">Ganancia</th>
                <th className="num">Pagado</th>
                <th className="num">Saldo</th>
                <th className="no-print">Detalle</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {cortes.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td>
                      {c.fecha}
                      {c.nota && <span className="tag">{c.nota}</span>}
                    </td>
                    <td className="money">{money(c.importe)}</td>
                    <td className="money">{money(c.ganancia)}</td>
                    <td className="money">{money(c.pagado)}</td>
                    <td className="money">{c.saldo > 0 ? money(c.saldo) : <span className="dim">—</span>}</td>
                    <td className="no-print">
                      <details className="corte-detail">
                        <summary>Productos</summary>
                        <div className="corte-items">
                          {c.items.map((it) => {
                            const p = snap.products.find((x) => x.id === it.product_id);
                            return (
                              <div key={it.product_id} className="corte-item">
                                <span>{p?.nombre ?? "?"}</span>
                                <span className="num">
                                  {qty(it.cantidad)} × {money(it.precio)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </td>
                    <td className="no-print">
                      <form action={deleteCorte}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn btn-ghost btn-danger" type="submit" title="Eliminar corte">
                          ×
                        </button>
                      </form>
                    </td>
                  </tr>
                </Fragment>
              ))}
              {cortes.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={7}>
                    Todavía no hay cortes para este vendedor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Registrar pago</h3>
              <div className="sub">Contra un corte o a cuenta</div>
            </div>
          </div>
          <div className="mt-4">
            <PaymentForm
              sellerId={id}
              cortes={cortes
                .filter((c) => c.saldo > 0)
                .map((c) => ({ id: c.id, fecha: c.fecha, importe: c.importe, saldo: c.saldo }))}
              fechaDefault={fechaDefault}
            />
          </div>
        </section>

        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Recoger / traspasar</h3>
              <div className="sub">La mercancía que decides retirar</div>
            </div>
          </div>
          <div className="mt-4">
            <RetiroForm
              sellerId={id}
              lines={lineOptions}
              destinos={destinos.map((s) => ({ id: s.id, nombre: s.nombre }))}
              fechaDefault={fechaDefault}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Venta manual</h3>
              <div className="sub">Si prefieres registrarla tú mismo</div>
            </div>
          </div>
          <div className="mt-4">
            <SaleForm sellerId={id} lines={lineOptions} fechaDefault={fechaDefault} />
          </div>
        </section>

        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Ajuste (merma)</h3>
              <div className="sub">Roto, perdido o baja en manos del vendedor</div>
            </div>
          </div>
          <div className="mt-4">
            <AjusteForm sellerId={id} lines={lineOptions} fechaDefault={fechaDefault} />
          </div>
        </section>
      </div>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Movimientos</h3>
            <div className="sub">Ventas, cortes, pagos y recogidas en orden</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th className="num">Cantidad</th>
                <th className="num">Monto</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.kind + m.id}>
                  <td>{m.fecha}</td>
                  <td>
                    <span className="tag">{m.kind}</span>
                  </td>
                  <td>
                    {m.desc}
                    {m.producto ? <span className="dim"> · {m.producto}</span> : null}
                  </td>
                  <td className="num">{m.cantidad != null ? qty(m.cantidad) : "—"}</td>
                  <td className="money">{m.monto != null ? money(m.monto) : "—"}</td>
                  <td className="no-print">
                    {m.kind === "venta" && (
                      <form action={deleteSale}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="btn btn-ghost btn-danger" type="submit" title="Eliminar venta">
                          ×
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {movs.length === 0 && (
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

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Datos y acceso del vendedor</h3>
            <div className="sub">Enlace, PIN y estado</div>
          </div>
        </div>
        <div className="mt-4">
          <SellerEditForm
            seller={{
              id: seller.id,
              nombre: seller.nombre,
              telefono: seller.telefono,
              activo: seller.activo,
              token: seller.token,
            }}
            base={base}
          />
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Renovar PIN</h3>
            <div className="sub">Genera un PIN nuevo si el vendedor olvidó el suyo</div>
          </div>
        </div>
        <div className="mt-4">
          <RenewPinButton sellerId={id} />
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Eliminar vendedor</h3>
            <div className="sub">Solo si nunca llegó a operar</div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {error === "historial" && (
            <p className="notice" role="alert">
              No se pudo eliminar: entre que se abrió esta página y pulsaste, al vendedor le quedó historial.
            </p>
          )}
          {historial > 0 ? (
            <p className="text-sm dim">
              <b>{seller.nombre}</b> ya tiene movimientos registrados ({qty(historial)} entre asignaciones,
              cortes, pagos, recogidas y ajustes), y de ellos dependen los reportes del negocio. Para que deje
              de entrar y reportar, desmarca <b>Vendedor activo</b> ahí arriba: se queda en la lista pero sin
              acceso.
            </p>
          ) : (
            <>
              <p className="text-sm dim">
                Este vendedor no tiene ningún movimiento, así que se puede borrar sin afectar a nada.
              </p>
              <form action={deleteSeller}>
                <input type="hidden" name="id" value={seller.id} />
                <button className="btn btn-danger" type="submit">
                  Eliminar a {seller.nombre}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </>
  );
}
