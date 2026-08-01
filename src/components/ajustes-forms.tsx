"use client";

import { useActionState } from "react";

import { changeAdminPin, updateSettings } from "@/actions/admin";

export function MonedaForm({ simbolo, codigo }: { simbolo: string; codigo: string }) {
  const [state, formAction, pending] = useActionState(updateSettings, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="a-simbolo">Símbolo</label>
          <input
            className="input"
            id="a-simbolo"
            name="moneda_simbolo"
            maxLength={4}
            defaultValue={simbolo}
            placeholder="$"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="a-codigo">Código (opcional)</label>
          <input
            className="input"
            id="a-codigo"
            name="moneda_codigo"
            maxLength={8}
            defaultValue={codigo}
            placeholder="PEN, USD…"
          />
        </div>
      </div>
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="notice" role="status">
          <b>Moneda actualizada.</b>
        </p>
      )}
      <div>
        <button className="btn btn-solid" type="submit" disabled={pending}>
          Guardar moneda
        </button>
      </div>
    </form>
  );
}

export function PinFormAdmin() {
  const [state, formAction, pending] = useActionState(changeAdminPin, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="field">
        <label htmlFor="a-actual">PIN actual</label>
        <input
          className="input"
          id="a-actual"
          name="actual"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="a-pin">PIN nuevo</label>
          <input
            className="input"
            id="a-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="a-pin2">Repite el PIN</label>
          <input
            className="input"
            id="a-pin2"
            name="pin2"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="new-password"
            required
          />
        </div>
      </div>
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="notice" role="status">
          <b>PIN cambiado.</b>
        </p>
      )}
      <div>
        <button className="btn btn-solid" type="submit" disabled={pending}>
          Cambiar PIN
        </button>
      </div>
    </form>
  );
}
