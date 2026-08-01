"use client";

import { useActionState, useState } from "react";

import { reportSale, sellerLogout } from "@/actions/seller";
import { useCurrency } from "@/components/currency";

export type VendorLine = {
  productId: string;
  product: string;
  enMano: number;
  precio: number;
};

export type VendorPending = {
  productId: string;
  product: string;
  cantidad: number;
  precio: number;
  monto: number;
};

export type VendorHistorial = {
  id: string;
  fecha: string;
  producto: string;
  cantidad: number;
  monto: number;
  cortada: boolean;
};

export type VendorPago = { id: string; fecha: string; monto: number; nota: string };

export function VendorPortal({
  token,
  nombre,
  telefono,
  lines,
  pendientes,
  historial,
  pagos,
  cuenta,
}: {
  token: string;
  nombre: string;
  telefono: string;
  lines: VendorLine[];
  pendientes: VendorPending[];
  historial: VendorHistorial[];
  pagos: VendorPago[];
  cuenta: { enMano: number; unidadesVendidas: number; debe: number; vendidoMonto: number };
}) {
  const { money, qty, fmtDate } = useCurrency();
  const [state, formAction, pending] = useActionState(reportSale, {});
  const [producto, setProducto] = useState("");
  const linea = lines.find((l) => l.productId === producto);
  const [cantidad, setCantidad] = useState("1");

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>{nombre}</h3>
            <div className="sub">{telefono ? `Tel. ${telefono} · ` : ""}Reporta tus ventas del día</div>
          </div>
          <form action={sellerLogout} className="no-print">
            <input type="hidden" name="token" value={token} />
            <button className="btn btn-ghost" type="submit">
              Salir
            </button>
          </form>
        </div>
        <div className="tiles mt-4">
          <div className="glass tile">
            <div className="tl">{qty(cuenta.enMano)}</div>
            <div className="ts">unidades en mano</div>
          </div>
          <div className="glass tile">
            <div className="tl">{qty(cuenta.unidadesVendidas)}</div>
            <div className="ts">unidades vendidas</div>
          </div>
          <div className="glass tile">
            <div className="tl">{money(cuenta.vendidoMonto)}</div>
            <div className="ts">vendido a precio</div>
          </div>
          <div className="glass tile">
            {/* Es lo cortado menos lo pagado, no lo que falta por cortar: eso
                sale abajo, en "Ventas reportadas". Si el vendedor abonó de más
                queda negativo, y "debes -$100" no se entiende: se enseña a favor. */}
            <div className="tl">{money(Math.abs(cuenta.debe))}</div>
            <div className="ts">{cuenta.debe < 0 ? "saldo a tu favor" : "pendiente de pagar"}</div>
          </div>
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Reportar venta</h3>
            <div className="sub">Elige el producto y cuántas unidades vendiste</div>
          </div>
        </div>
        <form action={formAction} className="flex flex-col gap-4 mt-4">
          <input type="hidden" name="token" value={token} />
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label htmlFor="v-prod">Producto</label>
              <select
                className="input"
                id="v-prod"
                name="product_id"
                required
                value={producto}
                onChange={(e) => {
                  setProducto(e.target.value);
                  setCantidad("1");
                }}
              >
                <option value="">— elegir —</option>
                {lines.map((l) => (
                  <option key={l.productId} value={l.productId}>
                    {l.product} ({qty(l.enMano)} en mano · {money(l.precio)})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="v-cant">Cantidad</label>
              <input
                className="input"
                id="v-cant"
                name="cantidad"
                type="number"
                min={1}
                max={linea?.enMano ?? 1}
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <span className="label">Importe</span>
              <div className="input input-static">{linea ? money(Number(cantidad) * linea.precio) : "—"}</div>
            </div>
          </div>
          {state?.error && (
            <p className="notice" role="alert">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p className="notice" role="status">
              <b>Venta reportada.</b> Sigue reportando o espera la visita del distribuidor.
            </p>
          )}
          <div>
            <button className="btn btn-solid" type="submit" disabled={pending || !linea}>
              Reportar venta
            </button>
          </div>
        </form>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Ventas reportadas</h3>
            <div className="sub">Lo que llevas reportado y aún no has cortado</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Cantidad</th>
                <th className="num">Precio</th>
                <th className="num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((p) => (
                <tr key={p.productId}>
                  <td>{p.product}</td>
                  <td className="num">{qty(p.cantidad)}</td>
                  <td className="num">{money(p.precio)}</td>
                  <td className="num money">{money(p.monto)}</td>
                </tr>
              ))}
              {pendientes.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={4}>
                    Todavía no has reportado ventas. Corte del día: {fmtDate(hoy)}.
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
            <h3>Mi historial</h3>
            <div className="sub">Todas tus ventas reportadas, con su estado</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th className="num">Cantidad</th>
                <th className="num">Importe</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((v) => (
                <tr key={v.id}>
                  <td>{fmtDate(v.fecha)}</td>
                  <td>{v.producto}</td>
                  <td className="num">{qty(v.cantidad)}</td>
                  <td className="num money">{money(v.monto)}</td>
                  <td>
                    {v.cortada ? (
                      <span className="chip">cortada</span>
                    ) : (
                      <span className="tag">pendiente</span>
                    )}
                  </td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={5}>
                    Aún no hay ventas reportadas.
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
            <h3>Pagos recibidos</h3>
            <div className="sub">Lo que el distribuidor ha registrado a tu favor</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="num">Monto</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.fecha)}</td>
                  <td className="num money">{money(p.monto)}</td>
                  <td>{p.nota || <span className="dim">—</span>}</td>
                </tr>
              ))}
              {pagos.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={3}>
                    Todavía no has recibido pagos registrados.
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
