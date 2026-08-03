"use client";

import { useActionState, useState } from "react";
import { createAssignment, createPurchase } from "@/actions/catalogo";
import { useCurrency } from "@/components/currency";

/**
 * `almacen` solo viaja en la asignación: una compra no tiene tope, pero
 * entregar sí. Cuando viene, la fila enseña cuánto hay y avisa antes de que el
 * servidor rechace la asignación entera.
 */
export type ProductOpt = { id: string; nombre: string; costo: number; precio: number; almacen?: number };
type Row = { key: number; productId: string; cantidad: string; costo: string; precio: string };

let rowSeq = 0;
const newRow = (): Row => ({ key: rowSeq++, productId: "", cantidad: "", costo: "", precio: "" });

function ProductRows({
  rows,
  setRows,
  products,
  showPrecio = false,
}: {
  rows: Row[];
  setRows: (r: Row[]) => void;
  products: ProductOpt[];
  showPrecio?: boolean;
}) {
  const { money } = useCurrency();
  const add = () => setRows([...rows, newRow()]);
  const del = (k: number) => setRows(rows.filter((r) => r.key !== k));
  const patch = (k: number, p: Partial<Row>) => setRows(rows.map((r) => (r.key === k ? { ...r, ...p } : r)));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const prod = products.find((p) => p.id === r.productId);
        return (
          <div
            key={r.key}
            className="grid gap-2"
            style={{ gridTemplateColumns: "minmax(140px,1fr) 84px 96px auto" }}
          >
            <select
              className="select"
              value={r.productId}
              onChange={(e) =>
                patch(r.key, {
                  productId: e.target.value,
                  costo: e.target.value
                    ? String(products.find((p) => p.id === e.target.value)?.costo ?? "")
                    : r.costo,
                  precio: e.target.value
                    ? String(products.find((p) => p.id === e.target.value)?.precio ?? "")
                    : r.precio,
                })
              }
            >
              <option value="">Elige…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.almacen !== undefined ? ` · ${p.almacen} en almacén` : ""}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min={0}
              max={prod?.almacen}
              step="any"
              placeholder="Cant."
              name={`qty_${r.productId}`}
              value={r.cantidad}
              onChange={(e) => patch(r.key, { cantidad: e.target.value })}
            />
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              placeholder="Costo"
              name={`cost_${r.productId}`}
              value={r.costo}
              onChange={(e) => patch(r.key, { costo: e.target.value })}
            />
            {showPrecio && (
              <input
                className="input"
                type="number"
                min={0}
                step="any"
                placeholder="Precio"
                name={`precio_${r.productId}`}
                value={r.precio}
                onChange={(e) => patch(r.key, { precio: e.target.value })}
              />
            )}
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => del(r.key)}
              aria-label="Quitar fila"
            >
              ×
            </button>
            {prod && <span className="text-xs dim self-center">{money(prod.precio)}</span>}
            {prod?.almacen !== undefined && Number(r.cantidad) > prod.almacen && (
              <p className="notice" role="alert" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
                Solo hay <b>{prod.almacen}</b> de {prod.nombre} en el almacén. Compra más antes de entregarle{" "}
                {r.cantidad}.
              </p>
            )}
          </div>
        );
      })}
      <div>
        <button className="btn" type="button" onClick={add}>
          + Añadir producto
        </button>
      </div>
    </div>
  );
}

export function PurchaseForm({
  products,
  almacenes,
  fechaDefault,
}: {
  products: ProductOpt[];
  almacenes: { id: string; nombre: string }[];
  fechaDefault: string;
}) {
  const [state, formAction, pending] = useActionState(createPurchase, {});
  const [rows, setRows] = useState<Row[]>([newRow()]);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="compra-fecha">Fecha</label>
          <input
            className="input"
            id="compra-fecha"
            name="fecha"
            type="date"
            defaultValue={fechaDefault}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="compra-almacen">Entra en</label>
          <select className="select" id="compra-almacen" name="ubicacion" required>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id === "alm-cuba" ? "cuba" : "eeuu"}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="compra-nota">Nota</label>
          <input className="input" id="compra-nota" name="nota" placeholder="Ej. proveedor" />
        </div>
      </div>
      <ProductRows rows={rows} setRows={setRows} products={products} />
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="notice" role="status">
          <b>Compra registrada.</b>
        </p>
      )}
      <div>
        <button className="btn btn-solid" type="submit" disabled={pending}>
          Registrar compra
        </button>
      </div>
    </form>
  );
}

export function AssignmentForm({
  products,
  sellers,
  almacenes,
  fechaDefault,
}: {
  products: ProductOpt[];
  sellers: { id: string; nombre: string }[];
  almacenes: { id: string; nombre: string }[];
  fechaDefault: string;
}) {
  const [state, formAction, pending] = useActionState(createAssignment, {});
  const [rows, setRows] = useState<Row[]>([newRow()]);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="asig-vendedor">Vendedor</label>
          <select className="select" id="asig-vendedor" name="seller_id" required>
            <option value="">Elige…</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="asig-fecha">Fecha</label>
            <input
              className="input"
              id="asig-fecha"
              name="fecha"
              type="date"
              defaultValue={fechaDefault}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="asig-almacen">Sale de</label>
            <select className="select" id="asig-almacen" name="almacen_id" required>
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="asig-costo">Costo de distribución</label>
            <input
              className="input"
              id="asig-costo"
              name="costo_distribucion"
              type="number"
              min={0}
              step="any"
              placeholder="0"
              title="Lo que cuesta hacerle llegar la mercancía. No entra en el costo unitario."
            />
          </div>
          <div className="field">
            <label htmlFor="asig-nota">Nota</label>
            <input className="input" id="asig-nota" name="nota" />
          </div>
        </div>
      </div>
      <ProductRows rows={rows} setRows={setRows} products={products} showPrecio />
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="notice" role="status">
          <b>Asignación registrada.</b> El vendedor ya ve la mercancía en su enlace.
        </p>
      )}
      <div>
        <button className="btn btn-solid" type="submit" disabled={pending}>
          Asignar mercancía
        </button>
      </div>
    </form>
  );
}
