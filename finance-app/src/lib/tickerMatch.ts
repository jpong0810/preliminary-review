import type { Holding } from "@prisma/client";

export type RelatedTicker = { ticker: string; price: number; currency?: string };

// Currency codes must never be treated as ticker matches. A cash holding's own "ticker"
// is often literally a currency code (e.g. a USD cash position), so without this denylist
// any price figure written with its currency ("96.36 USD") false-positives against that
// cash holding instead of being left unmatched.
const CURRENCY_CODES = new Set([
  "USD", "EUR", "GBP", "HKD", "CHF", "JPY", "CNY", "CNH", "AUD", "CAD", "SGD", "NZD",
  "SEK", "NOK", "DKK", "KRW", "INR", "MXN", "BRL", "ZAR", "THB", "TWD",
]);

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
    const sym = raw.replace("$", "").toUpperCase();
    if (CURRENCY_CODES.has(sym)) continue;
    const hit = holdings.find((h) => h.ticker.toUpperCase() === sym);
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
    if (CURRENCY_CODES.has(sym)) continue;
    if (!held.has(sym)) out.add(sym);
  }
  return Array.from(out);
}

// Standard proxy tickers for broad themes mentioned generically ("the market", "semis")
// with no specific holding to resolve against — these are looked up via web_search
// (never guessed), so a thought about "the market" is checkable later even when
// nothing in that theme is currently held.
const GENERIC_INDEX_PROXIES: { pattern: RegExp; tickers: string[] }[] = [
  { pattern: /\b(the )?(market|markets|broad market|indices|stocks in general|rebound|correction|sell[- ]?off|rally)\b/i, tickers: ["SPY", "QQQ"] },
  { pattern: /\b(semis?|semiconductors?|chips?)\b/i, tickers: ["SMH"] },
];

/** Standard proxy tickers implied by generic theme language, excluding any already resolved via a held position. */
export function impliedGenericTickers(text: string, alreadyMatched: string[]): string[] {
  const matched = new Set(alreadyMatched.map((t) => t.toUpperCase()));
  const out = new Set<string>();
  for (const { pattern, tickers } of GENERIC_INDEX_PROXIES) {
    if (pattern.test(text)) {
      for (const t of tickers) if (!matched.has(t)) out.add(t);
    }
  }
  return Array.from(out);
}
