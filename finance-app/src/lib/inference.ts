import Anthropic from "@anthropic-ai/sdk";
import type { Holding } from "@prisma/client";
import { localMatchRelatedTickers, possibleUnheldTickers, impliedGenericTickers, type RelatedTicker } from "./tickerMatch";

export type Sentiment = "bullish" | "bearish" | "neutral";

const BULLISH_WORDS = /\b(buy|bought|add(ing)?|dip|upside|bullish|long|opportunity|cheap|oversold|accumulate|rebound|rally)\b/i;
const BEARISH_WORDS = /\b(sell|sold|short|risk|correction|bearish|overvalued|expensive|stay away|caution|worried|bubble|sell[- ]?off)\b/i;

export function heuristicSentiment(text: string): Sentiment {
  const bull = BULLISH_WORDS.test(text);
  const bear = BEARISH_WORDS.test(text);
  if (bull && !bear) return "bullish";
  if (bear && !bull) return "bearish";
  return "neutral";
}

// Fallback-only (no ANTHROPIC_API_KEY): crude, filters common filler words, but
// can't actually understand topic/entities the way the AI path below can.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "have", "will", "from", "about",
  "should", "would", "could", "month", "months", "year", "years", "week", "weeks",
  "think", "thought", "into", "over", "than", "just", "very", "much", "more",
  "some", "what", "when", "still", "even", "also", "back", "long", "term",
]);

export function heuristicTags(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);
}

function client(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export type InferredThoughtMeta = {
  sentiment: Sentiment;
  tags: string[];
  relatedTickers: RelatedTicker[];
};

/**
 * Server-side inference used by the in-app quick-add box (no Claude conversation open)
 * and as a fallback for the MCP add_thought tool when the caller doesn't already supply
 * sentiment/tags. Falls back to cheap local heuristics when no ANTHROPIC_API_KEY is
 * configured — real topic tags and generic-theme ticker lookups require the AI path.
 */
export async function inferThoughtMeta(
  text: string,
  holdings: Holding[],
  providedTags: string[] = []
): Promise<InferredThoughtMeta> {
  const localTickers = localMatchRelatedTickers(text, holdings);
  const anthropic = client();

  if (!anthropic) {
    return {
      sentiment: heuristicSentiment(text),
      tags: providedTags.length ? providedTags : heuristicTags(text),
      relatedTickers: localTickers,
    };
  }

  let sentiment: Sentiment = heuristicSentiment(text);
  let tags = providedTags;
  let searchedTickers: RelatedTicker[] = [];

  // Tickers to look up: explicit $TICKER mentions not currently held, plus standard
  // proxy tickers for generic theme language ("the market", "semis") not already
  // covered by a local holding match — e.g. "markets to rebound" -> SPY, QQQ.
  const explicitUnheld = possibleUnheldTickers(text, holdings);
  const genericProxies = impliedGenericTickers(text, [...localTickers.map((t) => t.ticker), ...explicitUnheld]);
  const toLookUp = Array.from(new Set([...explicitUnheld, ...genericProxies]));

  try {
    const heldSummary = holdings.length ? holdings.map((h) => `${h.ticker} (${h.sector})`).join(", ") : "(nothing held yet)";
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      tools: toLookUp.length ? [{ type: "web_search_20260209", name: "web_search" } as unknown as Anthropic.Tool] : undefined,
      messages: [
        {
          role: "user",
          content:
            `Classify this personal market/investing journal entry.\n\nEntry: "${text}"\n\n` +
            `Currently held positions: ${heldSummary}\n\n` +
            `1. sentiment: "bullish"|"bearish"|"neutral" — the overall market stance implied (bullish = constructive/buying view, ` +
            `bearish = cautious/defensive view, neutral = observational/no clear stance).\n` +
            `2. tags: 1-3 short lowercase tags identifying the SPECIFIC topic(s) or entity(ies) discussed — real subjects like ` +
            `"us-iran-war", "rate-cuts", "semis", "fed-policy" (hyphenate multi-word topics). Never generic sentence filler ` +
            `words like "should", "month", "think", "will".\n` +
            (toLookUp.length
              ? `3. For these tickers — ${toLookUp.join(", ")} — look up each one's REAL current price via web_search. ` +
                `Never guess a price; omit a ticker entirely if you can't find one.\n`
              : "") +
            `\nReturn ONLY compact JSON: {"sentiment": ..., "tags": [...]${toLookUp.length ? ', "related_tickers": [{"ticker": string, "price": number}]' : ""}}`,
        },
      ],
    });
    const textBlock = [...msg.content].reverse().find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.sentiment === "bullish" || parsed.sentiment === "bearish" || parsed.sentiment === "neutral") {
          sentiment = parsed.sentiment;
        }
        if (!providedTags.length && Array.isArray(parsed.tags)) {
          tags = parsed.tags.slice(0, 3).map((t: string) => String(t).toLowerCase());
        }
        if (Array.isArray(parsed.related_tickers)) {
          searchedTickers = parsed.related_tickers.filter(
            (t: unknown): t is RelatedTicker =>
              !!t && typeof (t as RelatedTicker).ticker === "string" && typeof (t as RelatedTicker).price === "number"
          );
        }
      }
    }
  } catch {
    // Degrade gracefully to heuristics already computed above.
  }

  if (!tags.length) tags = heuristicTags(text);

  return {
    sentiment,
    tags,
    relatedTickers: [...localTickers, ...searchedTickers],
  };
}
