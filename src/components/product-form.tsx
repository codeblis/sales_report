"use client";

import { useActionState } from "react";
import { createProduct, updateProduct } from "@/actions/catalogo";

export function ProductForm({
  product,
}: {
  product?: {
    id: string;
    codigo: string;
    nombre: string;
    categoria: string;
    costo: number;
    precio: number;
    activo: number;
  };
}) {
  const action = product ? updateProduct : createProduct;
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="p-codigo">Código</label>
          <input className="input" id="p-codigo" name="codigo" defaultValue={product?.codigo} />
        </div>
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label htmlFor="p-nombre">Nombre</label>
          <input className="input" id="p-nombre" name="nombre" defaultValue={product?.nombre} required />
        </div>
        <div className="field">
          <label htmlFor="p-categoria">Categoría</label>
          <input className="input" id="p-categoria" name="categoria" defaultValue={product?.categoria} />
        </div>
        <div className="field">
          <label htmlFor="p-costo">Costo unitario</label>
          <input
            className="input"
            id="p-costo"
            name="costo"
            type="number"
            min={0}
            step="any"
            defaultValue={product?.costo}
          />
        </div>
        <div className="field">
          <label htmlFor="p-precio">Precio de venta</label>
          <input
            className="input"
            id="p-precio"
            name="precio"
            type="number"
            min={0}
            step="any"
            defaultValue={product?.precio}
          />
        </div>
      </div>
      {product && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" value="1" defaultChecked={product.activo === 1} />
          Producto activo
        </label>
      )}
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="notice" role="status">
          <b>Guardado.</b>
        </p>
      )}
      <div>
        <button className="btn btn-solid" type="submit" disabled={pending}>
          {product ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}
