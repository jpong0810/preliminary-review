"use client";

import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { ensureChartsRegistered } from "./registerCharts";
import { categoricalColors } from "@/lib/chartColors";

ensureChartsRegistered();

export type DonutDatum = { label: string; value: number };

export function DonutChart({
  title,
  data,
  onSliceClick,
}: {
  title: string;
  data: DonutDatum[];
  onSliceClick?: (label: string) => void;
}) {
  const colors = useMemo(() => categoricalColors(data.length), [data.length]);
  const total = data.reduce((s, d) => s + d.value, 0);

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [{ data: data.map((d) => d.value), backgroundColor: colors, borderWidth: 2, borderColor: "var(--surface-1)" }],
  };

  return (
    <div className="card p-4 flex flex-col h-full">
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
        {title}
      </h3>
      {data.length === 0 || total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
          No data yet
        </div>
      ) : (
        <div className="flex-1 min-h-[220px]">
          <Doughnut
            data={chartData}
            options={{
              maintainAspectRatio: false,
              plugins: {
                legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, color: "var(--text-secondary)" } },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const v = ctx.parsed as number;
                      const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                      return ` ${ctx.label}: $${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${pct}%)`;
                    },
                  },
                },
              },
              onClick: (_evt, elements) => {
                if (elements.length && onSliceClick) {
                  const idx = elements[0].index;
                  onSliceClick(data[idx].label);
                }
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
