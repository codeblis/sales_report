"use client";

import { useActionState } from "react";

import { sellerLogin } from "@/actions/seller";

export function VendorLogin({ token, nombre }: { token: string; nombre: string }) {
  const [state, formAction, pending] = useActionState(sellerLogin, {});
  return (
    <section className="glass card enter">
      <div className="card-h" style={{ marginBottom: 18 }}>
        <div>
          <h3>Hola, {nombre}</h3>
          <div className="sub">Entra con tu PIN para reportar ventas</div>
        </div>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <div className="field">
          <label htmlFor="v-pin">Tu PIN</label>
          <input
            className="input"
            id="v-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="current-password"
            required
          />
        </div>
        {state?.error && (
          <p className="notice" role="alert">
            {state.error}
          </p>
        )}
        <div>
          <button className="btn btn-solid" type="submit" disabled={pending}>
            Entrar
          </button>
        </div>
      </form>
    </section>
  );
}
