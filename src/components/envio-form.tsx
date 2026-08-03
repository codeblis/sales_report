"use client";

import { useActionState, useState } from "react";

import { createEnvio } from "@/actions/envios";

export type EnvioProducto = { id: string; nombre: string; precio: number; disponible: number };

type Fila = { key: number; productId: string; cantidad: string; precio: string };
let seq = 0;
const nueva = (): Fila => ({ key: seq++, productId: "", cantidad: "", precio: "" });

/**
 * Despacho de un envío. El destino va en un solo selector porque un paquete
 * tiene un único destino: o un almacén o un vendedor.
 */
export function EnvioForm({
  almacenes,
  vendedores,
  productosPorAlmacen,
  fechaDefault,
}: {
  almacenes: { id: string; nombre: string; pais: string }[];
  vendedores: { id: string; nombre: string }[];
  /** Existencias de cada almacén, para no dejar enviar lo que no hay. */
  productosPorAlmacen: Record<string, EnvioProducto[]>;
  fechaDefault: string;
}) {
  const [state, formAction, pending] = useActionState(createEnvio, {});
  const [origen, setOrigen] = useState(almacenes[0]?.id ?? "");
  const [filas, setFilas] = useState<Fila[]>([nueva()]);

  const disponibles = productosPorAlmacen[origen] ?? [];
  const patch = (k: number, p: Partial<Fila>) =>
    setFilas(filas.map((f) => (f.key === k ? { ...f, ...p } : f)));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="env-origen">Sale de</label>
          <select
            className="select"
            id="env-origen"
            name="origen_id"
            value={origen}
            onChange={(e) => {
              setOrigen(e.target.value);
              setFilas([nueva()]);
            }}
            required
          >
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="env-destino">Llega a</label>
          <select className="select" id="env-destino" name="destino" required defaultValue="">
            <option value="">Elige…</option>
            {almacenes
              .filter((a) => a.id !== origen)
              .map((a) => (
                <option key={a.id} value={`almacen:${a.id}`}>
                  {a.nombre}
                </option>
              ))}
            {vendedores.map((v) => (
              <option key={v.id} value={`vendedor:${v.id}`}>
                Directo a {v.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="env-fecha">Fecha de salida</label>
          <input
            className="input"
            id="env-fecha"
            name="fecha"
            type="date"
            defaultValue={fechaDefault}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="env-costo">Costo del envío</label>
          <input className="input" id="env-costo" name="costo" type="number" min={0} step="any" />
        </div>
        <div className="field">
          <label htmlFor="env-nota">Nota</label>
          <input className="input" id="env-nota" name="nota" placeholder="Ej. paquete 3" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filas.map((f) => {
          const prod = disponibles.find((p) => p.id === f.productId);
          const pasa = prod ? Number(f.cantidad) > prod.disponible : false;
          return (
            <div
              key={f.key}
              className="grid gap-2"
              style={{ gridTemplateColumns: "minmax(140px,1fr) 84px 96px auto" }}
            >
              <select
                className="select"
                value={f.productId}
                onChange={(e) =>
                  patch(f.key, {
                    productId: e.target.value,
                    precio: String(disponibles.find((p) => p.id === e.target.value)?.precio ?? ""),
                  })
                }
              >
                <option value="">Elige…</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {p.disponible} disponibles
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min={0}
                max={prod?.disponible}
                step="any"
                placeholder="Cant."
                name={`qty_${f.productId}`}
                value={f.cantidad}
                onChange={(e) => patch(f.key, { cantidad: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min={0}
                step="any"
                placeholder="Precio"
                name={`precio_${f.productId}`}
                value={f.precio}
                onChange={(e) => patch(f.key, { precio: e.target.value })}
                title="Precio de venta, por si el envío va directo a un vendedor"
              />
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setFilas(filas.filter((x) => x.key !== f.key))}
                aria-label="Quitar fila"
              >
                ×
              </button>
              {pasa && prod && (
                <p className="notice" role="alert" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
                  Solo hay <b>{prod.disponible}</b> de {prod.nombre} en ese almacén.
                </p>
              )}
            </div>
          );
        })}
        <div>
          <button className="btn" type="button" onClick={() => setFilas([...filas, nueva()])}>
            + Añadir producto
          </button>
        </div>
      </div>

      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="notice" role="status">
          <b>Envío despachado.</b> La mercancía queda en tránsito hasta que confirmes su llegada.
        </p>
      )}
      <div>
        <button className="btn btn-solid" type="submit" disabled={pending || !disponibles.length}>
          {pending ? "Despachando…" : "Despachar envío"}
        </button>
      </div>
    </form>
  );
}
