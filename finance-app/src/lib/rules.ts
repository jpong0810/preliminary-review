import type { Holding, Rule } from "@prisma/client";
import { usdValue, normalizedGeography } from "./holdings";

export type ExposureEvaluation = {
  ruleId: number;
  label: string;
  metric: string;
  target: string;
  operator: string;
  threshold: number;
  actualPct: number;
  triggered: boolean;
};

/** Evaluates every exposure rule live against current holdings, using usd_value so currency never skews the result. */
export function evaluateExposureRules(rules: Rule[], holdings: Holding[]): ExposureEvaluation[] {
  const total = holdings.reduce((s, h) => s + usdValue(h), 0);

  return rules
    .filter((r) => r.ruleType === "exposure")
    .map((r) => {
      const metric = r.metric ?? "";
      const target = r.target ?? "";
      let matchedValue = 0;

      if (total > 0) {
        switch (metric) {
          case "holding":
            matchedValue = holdings
              .filter((h) => h.ticker.toLowerCase() === target.toLowerCase())
              .reduce((s, h) => s + usdValue(h), 0);
            break;
          case "category":
            matchedValue = holdings
              .filter((h) => h.category.toLowerCase() === target.toLowerCase())
              .reduce((s, h) => s + usdValue(h), 0);
            break;
          case "sector":
            matchedValue = holdings
              .filter((h) => h.sector.toLowerCase() === target.toLowerCase())
              .reduce((s, h) => s + usdValue(h), 0);
            break;
          case "geography":
            matchedValue = holdings.reduce((s, h) => {
              const geos = normalizedGeography(h);
              const match = geos.find((g) => g.region.toLowerCase() === target.toLowerCase());
              return s + (match ? usdValue(h) * (match.weight / 100) : 0);
            }, 0);
            break;
          case "tag":
            matchedValue = holdings
              .filter((h) => h.tags.some((t) => t.toLowerCase() === target.toLowerCase()))
              .reduce((s, h) => s + usdValue(h), 0);
            break;
        }
      }

      const actualPct = total > 0 ? (matchedValue / total) * 100 : 0;
      const threshold = r.threshold ?? 0;
      const triggered = r.operator === "min" ? actualPct < threshold : actualPct > threshold;

      return {
        ruleId: r.id,
        label: r.label,
        metric,
        target,
        operator: r.operator ?? "max",
        threshold,
        actualPct,
        triggered,
      };
    });
}
