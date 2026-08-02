"use client";

import { useActionState } from "react";

import { changeAdminPin, updateSettings } from "@/actions/admin";
import { ConfirmSubmit } from "@/components/confirm-submit";

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
        <ConfirmSubmit
          className="btn btn-solid"
          titulo="¿Cambiar la moneda?"
          detalle="Cambia el símbolo en toda la app, en los reportes y en el portal de los vendedores. No convierte ningún importe: las cifras guardadas se quedan como están."
          confirmar="Sí, cambiar"
          peligro={false}
          disabled={pending}
        >
          Guardar moneda
        </ConfirmSubmit>
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
        <ConfirmSubmit
          className="btn btn-solid"
          titulo="¿Cambiar tu PIN de administrador?"
          detalle="El PIN actual dejará de servir en cuanto se guarde. Si olvidas el nuevo, no hay forma de recuperar el acceso."
          confirmar="Sí, cambiarlo"
          disabled={pending}
        >
          Cambiar PIN
        </ConfirmSubmit>
      </div>
    </form>
  );
}
