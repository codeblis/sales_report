"use client";

import { ChartBars } from "@/components/chart";
import { useCurrency } from "@/components/currency";

export function MoneyBars({
  labels,
  values,
  units,
  height,
  horizontal = false,
}: {
  labels: string[];
  values: number[];
  units?: number[];
  height?: number;
  horizontal?: boolean;
}) {
  const { money, qty, fmtDate } = useCurrency();
  const fmtLabels = horizontal ? labels : labels.map(fmtDate);
  const extra = units ? (_n: number, i: number) => `${qty(units[i])} uds` : undefined;
  return (
    <ChartBars
      labels={fmtLabels}
      values={values}
      format={money}
      extra={extra}
      height={height}
      horizontal={horizontal}
    />
  );
}
