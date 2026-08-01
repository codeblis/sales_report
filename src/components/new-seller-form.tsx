"use client";

import { useActionState, useState } from "react";
import { createSeller } from "@/actions/sellers";

export function NewSellerForm() {
  const [state, formAction, pending] = useActionState(createSeller, {});
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const enlace = state?.token ? `${base}/v/${state.token}` : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="s-nombre">Nombre</label>
          <input
            className="input"
            id="s-nombre"
            name="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. María Pérez"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="s-tel">Teléfono (WhatsApp)</label>
          <input
            className="input"
            id="s-tel"
            name="telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Ej. +53 5 1234567"
          />
        </div>
      </div>
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && state.pin && (
        <div className="notice">
          <p>
            <b>{nombre || "Vendedor"}</b> creado. Envía el enlace y el PIN:
          </p>
          <p className="mt-2" style={{ wordBreak: "break-all" }}>
            🔗 {enlace}
          </p>
          <p className="mt-1">
            🔑 PIN: <b>{state.pin}</b>
          </p>
          <div className="flex gap-2 flex-wrap mt-3">
            <button className="btn" type="button" onClick={() => navigator.clipboard?.writeText(enlace)}>
              Copiar enlace
            </button>
            <a
              className="btn btn-solid"
              href={`https://wa.me/?text=${encodeURIComponent(
                `Tu enlace de reporte: ${enlace}\nTu PIN: ${state.pin}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Enviar por WhatsApp
            </a>
          </div>
        </div>
      )}
      <button className="btn btn-solid" type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear vendedor"}
      </button>
    </form>
  );
}
