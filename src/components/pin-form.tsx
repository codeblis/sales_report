"use client";

import { useActionState } from "react";
import { createAdminPin, loginAdmin } from "@/actions/admin";

export function PinForm({ mode }: { mode: "create" | "login" }) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createAdminPin : loginAdmin, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "create" && (
        <div className="field">
          <label htmlFor="setup_token">Token de instalación</label>
          <input
            className="input"
            id="setup_token"
            name="setup_token"
            type="password"
            autoComplete="off"
            required
          />
          <p className="text-sm dim">
            El que guardaste como <b>SETUP_TOKEN</b> en Cloudflare. Solo se pide ahora.
          </p>
        </div>
      )}
      <div className="field">
        <label htmlFor="pin">PIN</label>
        <input
          className="input"
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={6}
          required
        />
      </div>
      {mode === "create" && (
        <div className="field">
          <label htmlFor="pin2">Repite el PIN</label>
          <input
            className="input"
            id="pin2"
            name="pin2"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            required
          />
        </div>
      )}
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-solid" type="submit" disabled={pending}>
        {pending ? "Espera…" : mode === "create" ? "Crear y entrar" : "Entrar"}
      </button>
    </form>
  );
}
