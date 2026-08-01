"use client";

import { useActionState, useState } from "react";
import { createAjuste, createPayment, createRetiro, createSale } from "@/actions/negocio";
import { updateSeller } from "@/actions/sellers";
import { useCurrency } from "@/components/currency";

export type LineOption = { productId: string; product: string; enMano: number; precio: number };
export type CorteOption = { id: string; fecha: string; importe: number; saldo: number };

function Result({ ok, error }: { ok?: boolean; error?: string }) {
  if (error) {
    return (
      <p className="notice" role="alert">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p className="notice" role="status">
        <b>Registrado.</b>
      </p>
    );
  }
  return null;
}

/* ---------------- Venta manual ---------------- */

export function SaleForm({
  sellerId,
  lines,
  fechaDefault,
}: {
  sellerId: string;
  lines: LineOption[];
  fechaDefault: string;
}) {
  const [state, formAction, pending] = useActionState(createSale, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="seller_id" value={sellerId} />
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="sf-producto">Producto</label>
          <select className="select" id="sf-producto" name="product_id" required>
            <option value="">Elige…</option>
            {lines.map((l) => (
              <option key={l.productId} value={l.productId}>
                {l.product} ({l.enMano} uds)
              </option>
            ))}
          </select>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="sf-cant">Cantidad</label>
            <input className="input" id="sf-cant" name="cantidad" type="number" min={1} step="any" required />
          </div>
          <div className="field">
            <label htmlFor="sf-fecha">Fecha</label>
            <input
              className="input"
              id="sf-fecha"
              name="fecha"
              type="date"
              defaultValue={fechaDefault}
              required
            />
          </div>
        </div>
      </div>
      <Result {...state} />
      <div>
        <button className="btn" type="submit" disabled={pending}>
          Registrar venta
        </button>
      </div>
    </form>
  );
}

/* ---------------- Pago ---------------- */

export function PaymentForm({
  sellerId,
  cortes,
  fechaDefault,
}: {
  sellerId: string;
  cortes: CorteOption[];
  fechaDefault: string;
}) {
  const { money, fmtDate } = useCurrency();
  const [state, formAction, pending] = useActionState(createPayment, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="seller_id" value={sellerId} />
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="pf-monto">Monto</label>
          <input className="input" id="pf-monto" name="monto" type="number" min={0.01} step="any" required />
        </div>
        <div className="field">
          <label htmlFor="pf-fecha">Fecha</label>
          <input
            className="input"
            id="pf-fecha"
            name="fecha"
            type="date"
            defaultValue={fechaDefault}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="pf-corte">Contra corte (opcional)</label>
        <select className="select" id="pf-corte" name="corte_id">
          <option value="">A cuenta (sin corte)</option>
          {cortes.map((c) => (
            <option key={c.id} value={c.id}>
              Corte {fmtDate(c.fecha)} · saldo {money(c.saldo)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pf-nota">Nota</label>
        <input className="input" id="pf-nota" name="nota" />
      </div>
      <Result {...state} />
      <div>
        <button className="btn" type="submit" disabled={pending}>
          Registrar pago
        </button>
      </div>
    </form>
  );
}

/* ---------------- Recogida / traspaso ---------------- */

export function RetiroForm({
  sellerId,
  lines,
  destinos,
  fechaDefault,
}: {
  sellerId: string;
  lines: LineOption[];
  destinos: { id: string; nombre: string }[];
  fechaDefault: string;
}) {
  const { qty } = useCurrency();
  const [state, formAction, pending] = useActionState(createRetiro, {});
  const [cant, setCant] = useState<Record<string, string>>({});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="seller_id" value={sellerId} />
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="rf-destino">Destino</label>
          <select className="select" id="rf-destino" name="destino" defaultValue="almacen">
            <option value="almacen">Almacén (recoger)</option>
            {destinos.map((s) => (
              <option key={s.id} value={s.id}>
                Traspasar a {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rf-fecha">Fecha</label>
          <input
            className="input"
            id="rf-fecha"
            name="fecha"
            type="date"
            defaultValue={fechaDefault}
            required
          />
        </div>
      </div>
      {lines.length === 0 && <p className="nodata">Este vendedor no tiene mercancía en mano.</p>}
      <div className="flex flex-col gap-2">
        {lines.map((l) => (
          <div key={l.productId} className="flex items-center gap-3">
            <span className="flex-1 text-sm">
              {l.product} <span className="dim">({qty(l.enMano)} en mano)</span>
            </span>
            <input
              className="input"
              style={{ width: 110 }}
              type="number"
              min={0}
              max={l.enMano}
              step="any"
              placeholder="0"
              name={`qty_${l.productId}`}
              value={cant[l.productId] ?? ""}
              onChange={(e) => setCant((c) => ({ ...c, [l.productId]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor="rf-nota">Nota</label>
        <input className="input" id="rf-nota" name="nota" />
      </div>
      <Result {...state} />
      <div>
        <button className="btn" type="submit" disabled={pending || lines.length === 0}>
          Registrar recogida / traspaso
        </button>
      </div>
    </form>
  );
}

/* ---------------- Ajuste (merma en manos) ---------------- */

export function AjusteForm({
  sellerId,
  lines,
  fechaDefault,
}: {
  sellerId: string;
  lines: LineOption[];
  fechaDefault: string;
}) {
  const { qty } = useCurrency();
  const [state, formAction, pending] = useActionState(createAjuste, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="seller_id" value={sellerId} />
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="af-fecha">Fecha</label>
          <input
            className="input"
            id="af-fecha"
            name="fecha"
            type="date"
            defaultValue={fechaDefault}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="af-nota">Motivo</label>
          <input className="input" id="af-nota" name="nota" placeholder="Ej. roto, perdido" required />
        </div>
      </div>
      {lines.length === 0 && <p className="nodata">No hay mercancía en mano para ajustar.</p>}
      <div className="flex flex-col gap-2">
        {lines.map((l) => (
          <div key={l.productId} className="flex items-center gap-3">
            <span className="flex-1 text-sm">
              {l.product} <span className="dim">({qty(l.enMano)} en mano)</span>
            </span>
            <input
              className="input"
              style={{ width: 110 }}
              type="number"
              min={0}
              max={l.enMano}
              step="any"
              placeholder="0"
              name={`qty_${l.productId}`}
            />
          </div>
        ))}
      </div>
      <Result {...state} />
      <div>
        <button className="btn" type="submit" disabled={pending || lines.length === 0}>
          Registrar ajuste
        </button>
      </div>
    </form>
  );
}

/* ---------------- Editar vendedor (PIN, activo) ---------------- */

export function SellerEditForm({
  seller,
  base,
}: {
  seller: { id: string; nombre: string; telefono: string; activo: number; token: string };
  base: string;
}) {
  const [state, formAction, pending] = useActionState(updateSeller, {});
  const enlace = `${base}/v/${seller.token}`;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={seller.id} />
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="e-nombre">Nombre</label>
          <input className="input" id="e-nombre" name="nombre" defaultValue={seller.nombre} required />
        </div>
        <div className="field">
          <label htmlFor="e-tel">Teléfono</label>
          <input className="input" id="e-tel" name="telefono" defaultValue={seller.telefono} />
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="activo" value="1" defaultChecked={seller.activo === 1} />
          Vendedor activo (puede entrar y reportar)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="reset_pin" value="1" />
          Generar un PIN nuevo
        </label>
      </div>
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && state.pin && (
        <p className="notice" role="status">
          PIN nuevo: <b>{state.pin}</b>
        </p>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          Enlace del vendedor:{" "}
          <span className="mut" style={{ wordBreak: "break-all" }}>
            {enlace}
          </span>
        </p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn" type="button" onClick={() => navigator.clipboard?.writeText(enlace)}>
            Copiar enlace
          </button>
          <a
            className="btn"
            href={`https://wa.me/?text=${encodeURIComponent(`Tu enlace de reporte de ventas: ${enlace}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Enviar por WhatsApp
          </a>
        </div>
      </div>
      <div>
        <button className="btn" type="submit" disabled={pending}>
          Guardar
        </button>
      </div>
    </form>
  );
}
