"use client";

import { useActionState } from "react";
import { createProduct, updateProduct } from "@/actions/catalogo";
import { ConfirmSubmit } from "@/components/confirm-submit";

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
        {product ? (
          <ConfirmSubmit
            className="btn btn-solid"
            titulo={`¿Guardar los cambios de ${product.nombre}?`}
            detalle="El precio y el costo nuevos valen para lo que asignes a partir de ahora; lo ya asignado conserva el precio que tenía."
            confirmar="Sí, guardar"
            peligro={false}
            disabled={pending}
          >
            Guardar cambios
          </ConfirmSubmit>
        ) : (
          <button className="btn btn-solid" type="submit" disabled={pending}>
            Crear producto
          </button>
        )}
      </div>
    </form>
  );
}
