"use client";

import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from "chart.js";
import { useEffect, useRef } from "react";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
Chart.defaults.font.family = "-apple-system, system-ui, sans-serif";
Chart.defaults.color = "rgba(128,128,128,.6)";

function theme() {
  const dark = document.documentElement.classList.contains("dark");
  return {
    bar: dark ? "rgba(246,246,247,.88)" : "rgba(12,12,14,.85)",
    grid: dark ? "rgba(255,255,255,.07)" : "rgba(12,12,14,.08)",
    text: dark ? "rgba(246,246,247,.36)" : "rgba(12,12,14,.38)",
    text2: dark ? "rgba(246,246,247,.6)" : "rgba(12,12,14,.62)",
  };
}

export function ChartBars({
  labels,
  values,
  format,
  extra,
  height = 260,
  horizontal = false,
}: {
  labels: string[];
  values: number[];
  format: (n: number) => string;
  extra?: (n: number, i: number) => string;
  height?: number;
  horizontal?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (chartRef.current) chartRef.current.destroy();
    const t = theme();
    chartRef.current = new Chart(el, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: t.bar,
            maxBarThickness: horizontal ? 22 : 44,
            borderRadius: horizontal
              ? { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 }
              : { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 420 },
        indexAxis: horizontal ? "y" : "x",
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            padding: 11,
            cornerRadius: 10,
            titleFont: { size: 12, weight: 600 },
            bodyFont: { family: "ui-monospace, Menlo, monospace", size: 11 },
            callbacks: {
              label: (it) => {
                const i = it.dataIndex;
                const base = format(Number(it.raw));
                return extra ? `${base} · ${extra(Number(it.raw), i)}` : base;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: !horizontal },
            border: { display: false },
            ticks: { color: t.text, font: { family: "ui-monospace, Menlo, monospace", size: 10 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: t.grid },
            border: { display: false },
            ticks: {
              color: t.text,
              font: { family: "ui-monospace, Menlo, monospace", size: 10 },
              callback: (v) => format(Number(v)),
            },
          },
        },
      },
    });
    return () => {
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, values, format, extra, horizontal]);

  return (
    <div style={{ height }} className="relative w-full">
      <canvas ref={ref} />
    </div>
  );
}
