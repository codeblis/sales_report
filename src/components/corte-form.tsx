"use client";

import { useActionState, useState } from "react";
import { createCorte } from "@/actions/negocio";
import { useCurrency } from "@/components/currency";

export type CortePending = {
  productId: string;
  product: string;
  cantidad: number;
  precio: number;
};

/** El corte liquida lo vendido: cantidades precargadas y ajustables. */
export function CorteForm({
  sellerId,
  pending,
  fechaDefault,
}: {
  sellerId: string;
  pending: CortePending[];
  fechaDefault: string;
}) {
  const { money, qty } = useCurrency();
  const [state, formAction, pendingState] = useActionState(createCorte, {});
  const [cant, setCant] = useState<Record<string, string>>(() =>
    Object.fromEntries(pending.map((p) => [p.productId, String(p.cantidad)])),
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="seller_id" value={sellerId} />
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="corte-fecha">Fecha del corte</label>
          <input
            className="input"
            id="corte-fecha"
            name="fecha"
            type="date"
            defaultValue={fechaDefault}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="corte-nota">Nota</label>
          <input className="input" id="corte-nota" name="nota" placeholder="Opcional" />
        </div>
      </div>

      {pending.length === 0 && (
        <p className="nodata">
          No hay ventas reportadas pendientes de cortar. Cuando el vendedor reporte, podrás liquidarlas aquí.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {pending.map((p) => (
          <div key={p.productId} className="flex items-center gap-3">
            <span className="flex-1 text-sm">
              {p.product}
              <span className="dim">
                {" "}
                · reportadas {qty(p.cantidad)} uds · a {money(p.precio)}
              </span>
            </span>
            <input
              className="input"
              style={{ width: 110 }}
              type="number"
              min={0}
              step="any"
              name={`qty_${p.productId}`}
              value={cant[p.productId] ?? ""}
              onChange={(e) => setCant((c) => ({ ...c, [p.productId]: e.target.value }))}
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
          <b>Corte registrado.</b> Lo que exceda lo reportado se registró como vendido; lo que falte queda
          pendiente para el próximo corte.
        </p>
      )}
      <div>
        <button className="btn btn-solid" type="submit" disabled={pendingState || pending.length === 0}>
          Registrar corte
        </button>
      </div>
    </form>
  );
}
