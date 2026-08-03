"use client";

import { useState } from "react";

import { confirmImportedPurchase } from "@/actions/catalogo";
import type { ParsedProduct } from "@/lib/parse";

type Linea = ParsedProduct & { key: number };

/**
 * Revisión de la compra que propone una hoja de Excel con cantidades.
 *
 * El archivo no se da por bueno tal cual: se propone y el distribuidor corrige
 * cantidades y costos antes de confirmar. Solo al confirmar se da de alta el
 * catálogo y se registra la compra, que es lo que llena el almacén.
 */
export function ImportPurchaseReview({
  filas,
  hoja,
  fechaDefault,
  onCancelar,
  onHecho,
}: {
  filas: ParsedProduct[];
  hoja: string;
  fechaDefault: string;
  onCancelar: () => void;
  onHecho: () => void;
}) {
  const [lineas, setLineas] = useState<Linea[]>(filas.map((f, i) => ({ ...f, key: i })));
  const [fecha, setFecha] = useState(fechaDefault);
  const [ubicacion, setUbicacion] = useState<"eeuu" | "cuba">("eeuu");
  const [nota, setNota] = useState(`Importado de ${hoja}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (key: number, p: Partial<Linea>) =>
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const quitar = (key: number) => setLineas((ls) => ls.filter((l) => l.key !== key));

  const conCantidad = lineas.filter((l) => l.cantidad > 0);
  const unidades = conCantidad.reduce((s, l) => s + l.cantidad, 0);
  const total = conCantidad.reduce((s, l) => s + l.cantidad * l.costo, 0);

  async function confirmar() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("rows", JSON.stringify(conCantidad));
    fd.append("fecha", fecha);
    fd.append("nota", nota);
    fd.append("ubicacion", ubicacion);
    const r = await confirmImportedPurchase({}, fd);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onHecho();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="notice" style={{ marginBottom: 0 }}>
        La hoja <b>{hoja}</b> trae cantidades, así que se propone esta compra. Revísala y corrige lo que haga
        falta: <b>solo al confirmar</b> se da de alta el catálogo y entra la mercancía en el almacén.
      </p>

      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="imp-fecha">Fecha de la compra</label>
          <input
            className="input"
            id="imp-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="imp-ubicacion">Entra en</label>
          <select
            className="select"
            id="imp-ubicacion"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value === "cuba" ? "cuba" : "eeuu")}
          >
            <option value="eeuu">Almacén de Estados Unidos</option>
            <option value="cuba">Almacén de Cuba</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="imp-nota">Nota</label>
        <input className="input" id="imp-nota" value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>

      <div className="tscroll" style={{ maxHeight: 320 }}>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Cantidad</th>
              <th className="num">Costo</th>
              <th className="num">Importe</th>
              <th> </th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.key} className={l.cantidad > 0 ? "" : "dim"}>
                <td>
                  {l.nombre}
                  {l.codigo && <span className="tag">{l.codigo}</span>}
                </td>
                <td className="num">
                  <input
                    className="input"
                    style={{ width: 90 }}
                    type="number"
                    min={0}
                    step="any"
                    value={l.cantidad}
                    onChange={(e) => patch(l.key, { cantidad: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="num">
                  <input
                    className="input"
                    style={{ width: 90 }}
                    type="number"
                    min={0}
                    step="any"
                    value={l.costo}
                    onChange={(e) => patch(l.key, { costo: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="num money">{(l.cantidad * l.costo).toFixed(2)}</td>
                <td>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => quitar(l.key)}
                    aria-label={`Quitar ${l.nombre}`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="notice" style={{ marginBottom: 0 }}>
        <b>{conCantidad.length}</b> productos · <b>{unidades}</b> unidades · total <b>{total.toFixed(2)}</b>
        {lineas.length !== conCantidad.length && (
          <> · {lineas.length - conCantidad.length} filas sin cantidad quedan fuera</>
        )}
      </p>

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          className="btn btn-solid"
          type="button"
          disabled={busy || conCantidad.length === 0}
          onClick={confirmar}
        >
          {busy ? "Registrando…" : "Confirmar compra y llenar almacén"}
        </button>
        <button className="btn" type="button" onClick={onCancelar} disabled={busy}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
