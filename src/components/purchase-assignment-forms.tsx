"use client";

import { useActionState, useState } from "react";
import { createAssignment, createPurchase } from "@/actions/catalogo";
import { useCurrency } from "@/components/currency";

export type ProductOpt = { id: string; nombre: string; costo: number; precio: number };
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
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min={0}
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

export function PurchaseForm({ products, fechaDefault }: { products: ProductOpt[]; fechaDefault: string }) {
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
  fechaDefault,
}: {
  products: ProductOpt[];
  sellers: { id: string; nombre: string }[];
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
