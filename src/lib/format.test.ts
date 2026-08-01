import { describe, expect, it } from "vitest";

import { saldo, setCurrency } from "@/lib/format";

describe("saldo", () => {
  setCurrency("$");

  it("una deuda se enuncia tal cual", () => {
    expect(saldo(100)).toBe("$100");
  });

  it("un abono por delante de los cortes se enuncia a favor, no en negativo", () => {
    // El portal mostraba "$-100 pendiente de pagar" cuando el vendedor había
    // abonado sin tener ningún corte todavía.
    expect(saldo(-100)).toBe("$100 a favor");
  });

  it("la cuenta saldada no es a favor de nadie", () => {
    expect(saldo(0)).toBe("$0");
  });
});
