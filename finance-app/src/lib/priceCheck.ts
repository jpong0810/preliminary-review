import Anthropic from "@anthropic-ai/sdk";
import type { Rule, Holding } from "@prisma/client";

function client(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export type PriceRuleCheckResult = { ruleId: number; status: "ok" | "triggered"; note: string };

/** Web-search-backed check of a single price rule's freeform condition (e.g. "flag if down >5% from 3-month high"). */
export async function checkPriceRule(rule: Rule): Promise<PriceRuleCheckResult | null> {
  const anthropic = client();
  if (!anthropic || rule.ruleType !== "price" || !rule.ticker) return null;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      tools: [{ type: "web_search_20260209", name: "web_search" } as unknown as Anthropic.Tool],
      messages: [
        {
          role: "user",
          content:
            `Check this price-alert condition using current market data: ticker ${rule.ticker}, condition: "${rule.description}". ` +
            `Return ONLY compact JSON: {"status": "ok"|"triggered", "note": string} where note briefly explains the current data found ` +
            `and why the condition is or isn't triggered.`,
        },
      ],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.status === "ok" || parsed.status === "triggered") {
          return { ruleId: rule.id, status: parsed.status, note: String(parsed.note ?? "") };
        }
      }
    }
  } catch {
    // leave unresolved rather than guessing
  }
  return null;
}

export type FxRefreshResult = { holdingId: number; fxRateToUsd: number };

/** Looks up the current rate (1 `currency` = ? USD) via web_search. Returns null rather than ever guessing. */
export async function lookupFxRate(currency: string): Promise<number | null> {
  const anthropic = client();
  if (!anthropic || currency === "USD") return null;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      tools: [{ type: "web_search_20260209", name: "web_search" } as unknown as Anthropic.Tool],
      messages: [
        {
          role: "user",
          content: `Find the current ${currency} to USD exchange rate (1 ${currency} = ? USD). Return ONLY compact JSON: {"rate": number}.`,
        },
      ],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.rate === "number" && parsed.rate > 0) return parsed.rate;
      }
    }
  } catch {
    // leave stale rather than guessing
  }
  return null;
}

/** Refreshes fx_rate_to_usd for a non-USD holding via web_search. Same "on request, never live" category as price. */
export async function refreshFxRate(holding: Holding): Promise<FxRefreshResult | null> {
  const rate = await lookupFxRate(holding.currency);
  return rate != null ? { holdingId: holding.id, fxRateToUsd: rate } : null;
}

/**
 * On-demand current price for a ticker, e.g. to compare against a Thought's priceAtThought.
 * Deliberately not persisted/scheduled — called fresh each time the person asks, same
 * "on request, never live" category as the other lookups in this file.
 */
export async function lookupCurrentPrice(ticker: string, currency?: string): Promise<number | null> {
  const anthropic = client();
  if (!anthropic) return null;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      tools: [{ type: "web_search_20260209", name: "web_search" } as unknown as Anthropic.Tool],
      messages: [
        {
          role: "user",
          content:
            `Find the current market price for ticker ${ticker}` +
            (currency ? `, quoted in ${currency} (the same currency a prior price for this ticker was recorded in, so the two are directly comparable)` : "") +
            `. Return ONLY compact JSON: {"price": number}.`,
        },
      ],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.price === "number" && parsed.price > 0) return parsed.price;
      }
    }
  } catch {
    // leave unresolved rather than guessing
  }
  return null;
}
