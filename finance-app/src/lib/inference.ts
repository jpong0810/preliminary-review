import Anthropic from "@anthropic-ai/sdk";

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
};

/**
 * Server-side sentiment/tag inference used by the in-app quick-add box (no Claude
 * conversation open) and as a fallback for the MCP add_thought tool when the caller
 * doesn't already supply sentiment/tags. Falls back to cheap local heuristics when no
 * ANTHROPIC_API_KEY is configured.
 *
 * Deliberately has no notion of holdings or tickers: thoughts have zero correlation to
 * holdings, and relatedTickers is entirely explicit input (add_thought's
 * relatedTickerOverrides / update_thought's relatedTickers) — never auto-matched here.
 */
export async function inferThoughtMeta(text: string, providedTags: string[] = []): Promise<InferredThoughtMeta> {
  const anthropic = client();

  if (!anthropic) {
    return {
      sentiment: heuristicSentiment(text),
      tags: providedTags.length ? providedTags : heuristicTags(text),
    };
  }

  let sentiment: Sentiment = heuristicSentiment(text);
  let tags = providedTags;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content:
            `Classify this personal market/investing journal entry.\n\nEntry: "${text}"\n\n` +
            `1. sentiment: "bullish"|"bearish"|"neutral" — the overall market stance implied (bullish = constructive/buying view, ` +
            `bearish = cautious/defensive view, neutral = observational/no clear stance).\n` +
            `2. tags: 1-3 short lowercase tags identifying the SPECIFIC topic(s) or entity(ies) discussed — real subjects like ` +
            `"us-iran-war", "rate-cuts", "semis", "fed-policy" (hyphenate multi-word topics). Never generic sentence filler ` +
            `words like "should", "month", "think", "will".\n` +
            `\nReturn ONLY compact JSON: {"sentiment": ..., "tags": [...]}`,
        },
      ],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
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
      }
    }
  } catch {
    // Degrade gracefully to heuristics already computed above.
  }

  if (!tags.length) tags = heuristicTags(text);

  return { sentiment, tags };
}
