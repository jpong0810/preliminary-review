import type { Holding } from "@prisma/client";

export function usdValue(h: Pick<Holding, "quantity" | "price" | "fxRateToUsd">): number {
  return h.quantity * h.price * h.fxRateToUsd;
}

export function plNative(h: Pick<Holding, "quantity" | "price" | "costBasis">): number | null {
  if (h.costBasis == null) return null;
  return (h.price - h.costBasis) * h.quantity;
}

export function plPct(h: Pick<Holding, "price" | "costBasis">): number | null {
  if (h.costBasis == null || h.costBasis === 0) return null;
  return (h.price - h.costBasis) / h.costBasis;
}

const COMMODITY_TAG_RE = /commod/i;

/** Mutually-exclusive asset-allocation bucket, derived (not stored) from category + tags. */
export function assetAllocationBucket(h: Pick<Holding, "category" | "tags">): string {
  const cat = h.category.trim().toLowerCase();
  if (h.tags.some((t) => COMMODITY_TAG_RE.test(t))) return "Commodities";
  if (cat === "cash") return "Cash";
  if (cat === "derivative") return "Derivatives";
  // ETF, Stock, Fund, Private, and any custom category default to Equities
  return "Equities";
}

export type GeoWeight = { region: string; weight: number };

/** Normalizes geography_breakdown weights to sum to 100; falls back to a single-region [{region, weight:100}]. */
export function normalizedGeography(h: Pick<Holding, "geography" | "geographyBreakdown">): GeoWeight[] {
  const breakdown = h.geographyBreakdown as GeoWeight[] | null;
  if (Array.isArray(breakdown) && breakdown.length > 0) {
    const total = breakdown.reduce((s, g) => s + (g.weight || 0), 0);
    if (total > 0) {
      return breakdown.map((g) => ({ region: g.region, weight: (g.weight / total) * 100 }));
    }
  }
  return [{ region: h.geography || "Unclassified", weight: 100 }];
}
