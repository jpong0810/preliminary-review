import type { Holding } from "@prisma/client";

export type RelatedTicker = { ticker: string; price: number };

// Small built-in keyword map for generic phrases -> a resolver against the person's
// actual holdings. Deliberately NOT a hardcoded ticker list: it resolves dynamically
// against whatever the current portfolio holds, so it generalizes across portfolios.
const KEYWORD_RESOLVERS: { pattern: RegExp; resolve: (holdings: Holding[]) => Holding[] }[] = [
  {
    pattern: /\b(the )?(market|markets|broad market|indices|stocks in general)\b/i,
    resolve: (holdings) => holdings.filter((h) => h.sector.toLowerCase() === "broad market"),
  },
  {
    pattern: /\b(semis?|semiconductors?|chips?)\b/i,
    resolve: (holdings) =>
      holdings.filter((h) => h.tags.some((t) => /semi|chip/i.test(t)) || h.sector.toLowerCase() === "technology" && /semi|chip/i.test(h.name)),
  },
];

/**
 * Instant, free, local-only resolution of a thought's text to related tickers:
 * (a) explicit ticker symbols that match a currently-held position, or
 * (b) built-in keyword phrases mapped to whichever holdings they generalize to.
 * Never performs a network lookup — that's the separate, slower web_search fallback
 * for tickers that are implied but NOT currently held.
 */
export function localMatchRelatedTickers(text: string, holdings: Holding[]): RelatedTicker[] {
  const matched = new Map<string, RelatedTicker>();

  // (a) explicit ticker match, e.g. "SMH", "$NBIS"
  const tokens = text.match(/\$?[A-Z]{1,5}\b/g) ?? [];
  for (const raw of tokens) {
    const sym = raw.replace("$", "");
    const hit = holdings.find((h) => h.ticker.toUpperCase() === sym.toUpperCase());
    if (hit && !matched.has(hit.ticker)) {
      matched.set(hit.ticker, { ticker: hit.ticker, price: hit.price });
    }
  }

  // (b) keyword -> category resolution
  for (const { pattern, resolve } of KEYWORD_RESOLVERS) {
    if (pattern.test(text)) {
      for (const h of resolve(holdings)) {
        if (!matched.has(h.ticker)) matched.set(h.ticker, { ticker: h.ticker, price: h.price });
      }
    }
  }

  return Array.from(matched.values());
}

/** Cheap heuristic ticker-like tokens mentioned in text that are NOT among current holdings — candidates for the web_search fallback. */
export function possibleUnheldTickers(text: string, holdings: Holding[]): string[] {
  const held = new Set(holdings.map((h) => h.ticker.toUpperCase()));
  const tokens = text.match(/\$[A-Z]{1,5}\b/g) ?? [];
  const out = new Set<string>();
  for (const raw of tokens) {
    const sym = raw.replace("$", "").toUpperCase();
    if (!held.has(sym)) out.add(sym);
  }
  return Array.from(out);
}
