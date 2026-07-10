"use client";

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { ensureChartsRegistered } from "./registerCharts";
import { resolveColor } from "@/lib/chartColors";

ensureChartsRegistered();

export type BarDatum = { label: string; value: number };

export function BarChart({
  title,
  data,
  onBarClick,
  horizontal = true,
}: {
  title: string;
  data: BarDatum[];
  onBarClick?: (label: string) => void;
  horizontal?: boolean;
}) {
  const color = useMemo(() => resolveColor("var(--series-1)"), []);

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [{ data: data.map((d) => d.value), backgroundColor: color, borderRadius: 4, maxBarThickness: 28 }],
  };

  return (
    <div className="card p-4 flex flex-col h-full">
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
        {title}
      </h3>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
          No data yet
        </div>
      ) : (
        <div className="flex-1 min-h-[220px]">
          <Bar
            data={chartData}
            options={{
              indexAxis: horizontal ? "y" : "x",
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const v = (horizontal ? ctx.parsed.x : ctx.parsed.y) ?? 0;
                      return ` $${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                    },
                  },
                },
              },
              scales: {
                x: { grid: { color: "var(--gridline)" }, ticks: { color: "var(--text-muted)", font: { size: 11 } } },
                y: { grid: { display: false }, ticks: { color: "var(--text-muted)", font: { size: 11 } } },
              },
              onClick: (evt, elements) => {
                if (elements.length && onBarClick) onBarClick(data[elements[0].index].label);
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
