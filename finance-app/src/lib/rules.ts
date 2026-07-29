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

// ---------------------------------------------------------------------------
// Rules tab: richer classification (ok/close/breached/unmapped), section
// grouping, and holding-metric weight-vs-count inference.
// ---------------------------------------------------------------------------

export type ExposureStatus = "ok" | "close" | "breached" | "unmapped";
export type RuleSection = "Allocation targets" | "Cash management" | "Stock-specific" | "Process/discipline";

export type ExposureRuleDetail = {
  ruleId: number;
  label: string;
  metric: string;
  target: string;
  operator: "min" | "max";
  threshold: number;
  actualValue: number;
  unit: "pct" | "count";
  status: ExposureStatus;
  note: string;
  section: RuleSection;
};

const CLOSE_MARGIN_PCT = 2;
const CLOSE_MARGIN_COUNT = 1;
const COUNT_HINT_RE = /count|number of|how many|distinct|individual stock|positions?\b/i;

function classify(actual: number, operator: "min" | "max", threshold: number, margin: number): "ok" | "close" | "breached" {
  const breached = operator === "min" ? actual < threshold : actual > threshold;
  if (breached) return "breached";
  return Math.abs(actual - threshold) <= margin ? "close" : "ok";
}

function inferSection(metric: string, label: string, target: string): RuleSection {
  if (metric === "holding") return "Stock-specific";
  if (`${label} ${target}`.toLowerCase().includes("cash")) return "Cash management";
  return "Allocation targets";
}

/** Case-insensitive exact match first, then substring fuzzy match; null means no reasonable match at all. */
function findMatch(target: string, candidates: string[]): { kind: "exact" | "fuzzy" | "none"; value?: string } {
  const t = target.trim().toLowerCase();
  const exact = candidates.find((c) => c.toLowerCase() === t);
  if (exact) return { kind: "exact", value: exact };
  const fuzzy = candidates.find((c) => c.toLowerCase().includes(t) || t.includes(c.toLowerCase()));
  if (fuzzy) return { kind: "fuzzy", value: fuzzy };
  return { kind: "none" };
}

/** Evaluates every exposure rule for the Rules tab: adds ok/close/breached/unmapped status,
 * a human note, and a section grouping — plus best-effort fuzzy matching for metric/target
 * combos that don't line up exactly with a holding field. */
export function evaluateExposureRulesDetailed(rules: Rule[], holdings: Holding[]): ExposureRuleDetail[] {
  const total = holdings.reduce((s, h) => s + usdValue(h), 0);
  const tickers = Array.from(new Set(holdings.map((h) => h.ticker)));
  const categories = Array.from(new Set(holdings.map((h) => h.category)));
  const sectors = Array.from(new Set(holdings.map((h) => h.sector)));
  const tags = Array.from(new Set(holdings.flatMap((h) => h.tags)));
  const geographies = Array.from(new Set(holdings.flatMap((h) => normalizedGeography(h).map((g) => g.region))));

  return rules
    .filter((r) => r.ruleType === "exposure")
    .map((r): ExposureRuleDetail => {
      const metric = r.metric ?? "";
      const target = r.target ?? "";
      const operator: "min" | "max" = r.operator === "min" ? "min" : "max";
      const threshold = r.threshold ?? 0;
      const section = inferSection(metric, r.label, target);
      const base = { ruleId: r.id, label: r.label, metric, target, operator, threshold, section };

      if (total === 0) {
        return { ...base, actualValue: 0, unit: "pct", status: "unmapped", note: "No holdings to evaluate against." };
      }

      if (metric === "holding") {
        const tickerMatch = tickers.find((t) => t.toLowerCase() === target.toLowerCase());
        if (tickerMatch) {
          const matchedUsd = holdings
            .filter((h) => h.ticker.toLowerCase() === target.toLowerCase())
            .reduce((s, h) => s + usdValue(h), 0);
          const actualPct = (matchedUsd / total) * 100;
          return {
            ...base,
            actualValue: actualPct,
            unit: "pct",
            status: classify(actualPct, operator, threshold, CLOSE_MARGIN_PCT),
            note: `${target} at ${actualPct.toFixed(1)}%, ${operator} ${threshold}%`,
          };
        }
        if (COUNT_HINT_RE.test(`${r.label} ${target}`)) {
          const stockOnly = /stock/i.test(`${r.label} ${target}`);
          const count = stockOnly
            ? new Set(holdings.filter((h) => h.category.toLowerCase() === "stock").map((h) => h.ticker)).size
            : tickers.length;
          return {
            ...base,
            actualValue: count,
            unit: "count",
            status: classify(count, operator, threshold, CLOSE_MARGIN_COUNT),
            note: `${count} distinct ${stockOnly ? "stock" : "holding"} positions, ${operator} ${threshold}`,
          };
        }
        return {
          ...base,
          actualValue: 0,
          unit: "pct",
          status: "unmapped",
          note: `"${target}" doesn't match any ticker or a recognizable position-count rule — needs manual mapping.`,
        };
      }

      const valuesByMetric: Record<string, string[]> = { category: categories, sector: sectors, tag: tags, geography: geographies };
      const candidates = valuesByMetric[metric];
      if (!candidates) {
        return { ...base, actualValue: 0, unit: "pct", status: "unmapped", note: `Unrecognized metric "${metric}" — needs manual mapping.` };
      }

      const match = findMatch(target, candidates);
      if (match.kind === "none") {
        return {
          ...base,
          actualValue: 0,
          unit: "pct",
          status: "unmapped",
          note: `"${target}" doesn't cleanly match any ${metric} in your holdings — needs manual mapping.`,
        };
      }

      const matchedLabel = match.value!;
      let matchedUsd = 0;
      if (metric === "geography") {
        matchedUsd = holdings.reduce((s, h) => {
          const found = normalizedGeography(h).find((g) => g.region.toLowerCase() === matchedLabel.toLowerCase());
          return s + (found ? usdValue(h) * (found.weight / 100) : 0);
        }, 0);
      } else if (metric === "tag") {
        matchedUsd = holdings
          .filter((h) => h.tags.some((t) => t.toLowerCase() === matchedLabel.toLowerCase()))
          .reduce((s, h) => s + usdValue(h), 0);
      } else if (metric === "category") {
        matchedUsd = holdings.filter((h) => h.category.toLowerCase() === matchedLabel.toLowerCase()).reduce((s, h) => s + usdValue(h), 0);
      } else if (metric === "sector") {
        matchedUsd = holdings.filter((h) => h.sector.toLowerCase() === matchedLabel.toLowerCase()).reduce((s, h) => s + usdValue(h), 0);
      }

      const actualPct = (matchedUsd / total) * 100;
      const fuzzyNote = match.kind === "fuzzy" ? ` (matched "${matchedLabel}")` : "";
      return {
        ...base,
        actualValue: actualPct,
        unit: "pct",
        status: classify(actualPct, operator, threshold, CLOSE_MARGIN_PCT),
        note: `${target}${fuzzyNote} at ${actualPct.toFixed(1)}%, ${operator} ${threshold}%`,
      };
    });
}
