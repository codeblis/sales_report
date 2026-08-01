"use client";

import { useActionState } from "react";
import { createAdminPin, loginAdmin } from "@/actions/admin";

export function PinForm({ mode }: { mode: "create" | "login" }) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createAdminPin : loginAdmin, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
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
