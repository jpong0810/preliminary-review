// Thoughts have zero correlation to holdings: relatedTickers is entirely explicit input
// (add_thought's relatedTickerOverrides / update_thought's relatedTickers) — there's no
// text-scanning or holdings-lookup that auto-populates it. This file used to hold that
// matching logic; it's gone, and only the shared type remains.
export type RelatedTicker = { ticker: string; price: number; currency?: string };
