"use client";

import { useActionState, useState } from "react";

import { createAjuste } from "@/actions/negocio";
import { useCurrency } from "@/components/currency";

export type WarehouseLine = { productId: string; product: string; almacen: number };

/** Ajuste de existencias en el almacén: merma, pérdida o corrección a la baja. */
export function WarehouseAdjustForm({
  lines,
  fechaDefault,
}: {
  lines: WarehouseLine[];
  fechaDefault: string;
}) {
  const { qty } = useCurrency();
  const [state, formAction, pending] = useActionState(createAjuste, {});
  const [cant, setCant] = useState<Record<string, string>>({});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="seller_id" value="" />
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="waf-fecha">Fecha</label>
          <input
            className="input"
            id="waf-fecha"
            name="fecha"
            type="date"
            defaultValue={fechaDefault}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="waf-nota">Motivo</label>
          <input
            className="input"
            id="waf-nota"
            name="nota"
            placeholder="Ej. vencido, roto, inventario"
            required
          />
        </div>
      </div>
      {lines.length === 0 && <p className="nodata">El almacén está vacío.</p>}
      <div className="flex flex-col gap-2">
        {lines.map((l) => (
          <div key={l.productId} className="flex items-center gap-3">
            <span className="flex-1 text-sm">
              {l.product} <span className="dim">({qty(l.almacen)} en almacén)</span>
            </span>
            <input
              className="input"
              style={{ width: 110 }}
              type="number"
              min={0}
              max={l.almacen}
              step="any"
              placeholder="0"
              name={`qty_${l.productId}`}
              value={cant[l.productId] ?? ""}
              onChange={(e) => setCant((c) => ({ ...c, [l.productId]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="notice" role="status">
          <b>Ajuste registrado.</b>
        </p>
      )}
      <div>
        <button className="btn" type="submit" disabled={pending || lines.length === 0}>
          Registrar ajuste de almacén
        </button>
      </div>
    </form>
  );
}
