"use client";

import { useRef } from "react";

/**
 * Botón que pide confirmación antes de enviar el formulario que lo contiene.
 *
 * Sustituye al `<button type="submit">` de cualquier formulario que modifique o
 * borre algo. El botón visible no envía nada: abre un `<dialog>` y solo el
 * botón de dentro es el `submit` de verdad, así que un clic despistado no
 * ejecuta la acción.
 *
 * Se usa `<dialog>` y no `confirm()` del navegador por dos razones: `confirm()`
 * bloquea el hilo de la página, y esto vive dentro de tablas con scroll donde
 * un aviso en línea quedaría recortado. El diálogo se pinta en la capa
 * superior, así que ni el `overflow` ni el `z-index` lo afectan.
 */
export function ConfirmSubmit({
  children,
  titulo,
  detalle,
  confirmar = "Sí, eliminar",
  className = "btn btn-ghost btn-danger",
  title,
  peligro = true,
  disabled = false,
}: {
  /** Contenido del botón visible (a menudo solo "×"). */
  children: React.ReactNode;
  /** La pregunta. Debe nombrar lo que se va a tocar, no un "¿estás seguro?" pelado. */
  titulo: string;
  /** Qué consecuencia tiene. Sobre todo si no se puede deshacer. */
  detalle?: React.ReactNode;
  confirmar?: string;
  className?: string;
  title?: string;
  /** Tiñe de rojo el botón de confirmar. Se apaga para cambios que no destruyen nada. */
  peligro?: boolean;
  disabled?: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className={className}
        type="button"
        title={title}
        disabled={disabled}
        onClick={() => dialogo.current?.showModal()}
      >
        {children}
      </button>

      <dialog className="confirm" ref={dialogo}>
        <h4>{titulo}</h4>
        {detalle && <p className="confirm-detalle">{detalle}</p>}
        <div className="confirm-acciones">
          <button className="btn btn-ghost" type="button" onClick={() => dialogo.current?.close()}>
            Cancelar
          </button>
          <button
            className={peligro ? "btn btn-danger" : "btn btn-solid"}
            type="submit"
            // El cierre va en un timeout porque la acción por defecto del clic
            // (enviar el formulario) se despacha después de los manejadores:
            // cerrar aquí mismo se la puede llevar por delante.
            onClick={() => setTimeout(() => dialogo.current?.close(), 0)}
          >
            {confirmar}
          </button>
        </div>
      </dialog>
    </>
  );
}
