"use client";

import { useActionState } from "react";

import { createGasto } from "@/actions/negocio";

/** Alta de un gasto del negocio: renta, transporte, sueldos, etc. */
export function GastoForm({ fechaDefault, categorias }: { fechaDefault: string; categorias: string[] }) {
  const [state, formAction, pending] = useActionState(createGasto, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="g-fecha">Fecha</label>
          <input
            className="input"
            id="g-fecha"
            name="fecha"
            type="date"
            defaultValue={fechaDefault}
            required
          />
        </div>
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label htmlFor="g-concepto">Concepto</label>
          <input
            className="input"
            id="g-concepto"
            name="concepto"
            placeholder="Ej. renta del local, gasolina"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="g-categoria">Categoría</label>
          <input
            className="input"
            id="g-categoria"
            name="categoria"
            list="g-categorias"
            placeholder="Ej. transporte"
          />
          <datalist id="g-categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="g-monto">Monto</label>
          <input className="input" id="g-monto" name="monto" type="number" min={0} step="any" required />
        </div>
      </div>
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="notice" role="status">
          <b>Gasto registrado.</b>
        </p>
      )}
      <div>
        <button className="btn btn-solid" type="submit" disabled={pending}>
          Registrar gasto
        </button>
      </div>
    </form>
  );
}
