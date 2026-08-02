"use client";

import { useActionState } from "react";

import { renewSellerPin } from "@/actions/sellers";
import { ConfirmSubmit } from "@/components/confirm-submit";

export function RenewPinButton({ sellerId, compact = false }: { sellerId: string; compact?: boolean }) {
  const [state, formAction, pending] = useActionState(
    (_prev: { error?: string; ok?: boolean; pin?: string }) => renewSellerPin(sellerId),
    {},
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <ConfirmSubmit
          className={compact ? "btn btn-ghost" : "btn"}
          titulo="¿Generar un PIN nuevo?"
          detalle="El PIN actual dejará de funcionar de inmediato. Tendrás que comunicarle el nuevo al vendedor o se quedará sin poder entrar."
          confirmar="Sí, generar"
          disabled={pending}
        >
          {compact ? "Renovar PIN" : "Renovar PIN del vendedor"}
        </ConfirmSubmit>
      </form>
      {state?.error && (
        <p className="notice" role="alert" style={{ marginBottom: 0 }}>
          {state.error}
        </p>
      )}
      {state?.ok && state.pin && (
        <div className="notice" role="status" style={{ marginBottom: 0 }}>
          <div className="text-sm">PIN nuevo para este vendedor:</div>
          <div className="chip" style={{ fontSize: "1.1rem", padding: "6px 14px", margin: "6px 0" }}>
            {state.pin}
          </div>
          <div className="text-sm dim">Comunícalo por WhatsApp; el PIN anterior dejará de funcionar.</div>
        </div>
      )}
    </div>
  );
}
