"use client";

import { createContext, useContext } from "react";

const NF = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

type Ctx = {
  money: (n: number) => string;
  moneyRaw: (n: number) => string;
  qty: (n: number) => string;
  fmtDate: (iso: string) => string;
};

const CurrencyCtx = createContext<Ctx>({
  money: (n) => `$${NF0.format(n)}`,
  moneyRaw: (n) => NF0.format(n),
  qty: (n) => NF.format(n),
  fmtDate: (iso) => iso,
});

export function CurrencyProvider({
  symbol,
  code,
  children,
}: {
  symbol: string;
  code: string;
  children: React.ReactNode;
}) {
  const money = (n: number) => {
    const v = Number.isFinite(n) ? n : 0;
    const body = Number.isInteger(v) ? NF0.format(v) : NF.format(v);
    return `${symbol}${body}${code ? ` ${code}` : ""}`;
  };
  const moneyRaw = (n: number) => {
    const v = Number.isFinite(n) ? n : 0;
    return Number.isInteger(v) ? NF0.format(v) : NF.format(v);
  };
  const qty = (n: number) => (Number.isFinite(n) ? NF.format(n) : "0");
  const fmtDate = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
  };
  return <CurrencyCtx.Provider value={{ money, moneyRaw, qty, fmtDate }}>{children}</CurrencyCtx.Provider>;
}

export function useCurrency(): Ctx {
  return useContext(CurrencyCtx);
}
