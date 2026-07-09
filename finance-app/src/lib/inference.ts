import Anthropic from "@anthropic-ai/sdk";
import type { Holding } from "@prisma/client";
import { localMatchRelatedTickers, possibleUnheldTickers, type RelatedTicker } from "./tickerMatch";

export type Sentiment = "bullish" | "bearish" | "neutral";

const BULLISH_WORDS = /\b(buy|bought|add(ing)?|dip|upside|bullish|long|opportunity|cheap|oversold|accumulate)\b/i;
const BEARISH_WORDS = /\b(sell|sold|short|risk|correction|bearish|overvalued|expensive|stay away|caution|worried|bubble)\b/i;

export function heuristicSentiment(text: string): Sentiment {
  const bull = BULLISH_WORDS.test(text);
  const bear = BEARISH_WORDS.test(text);
  if (bull && !bear) return "bullish";
  if (bear && !bull) return "bearish";
  return "neutral";
}

const STOPWORDS = new Set(["the", "and", "for", "with", "that", "this", "have", "will", "from", "about"]);

export function heuristicTags(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
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
 * sentiment/tags. Falls back to cheap local heuristics when no ANTHROPIC_API_KEY is configured.
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

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content:
            `Classify this personal market/investing journal entry.\n\nEntry: "${text}"\n\n` +
            `Return ONLY compact JSON: {"sentiment": "bullish"|"bearish"|"neutral", "tags": string[]} ` +
            `where sentiment reflects the overall market stance implied (bullish = constructive/buying view, ` +
            `bearish = cautious/defensive view, neutral = observational/no clear stance), and tags is 1-3 short ` +
            `lowercase single-or-two-word tags summarizing the topic.`,
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

  // Web-search fallback for tickers implied by the text but not currently held.
  const unheld = possibleUnheldTickers(text, holdings);
  let searchedTickers: RelatedTicker[] = [];
  if (unheld.length) {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 500,
        tools: [{ type: "web_search_20250305", name: "web_search" } as unknown as Anthropic.Tool],
        messages: [
          {
            role: "user",
            content: `Find the current stock price (in USD) for these tickers: ${unheld.join(", ")}. Return ONLY compact JSON: [{"ticker": string, "price": number}]. If a price genuinely can't be found, omit that ticker rather than guessing.`,
          },
        ],
      });
      const textBlock = msg.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const match = textBlock.text.match(/\[[\s\S]*\]/);
        if (match) searchedTickers = JSON.parse(match[0]);
      }
    } catch {
      // No price found — never guess, just omit.
    }
  }

  return {
    sentiment,
    tags,
    relatedTickers: [...localTickers, ...searchedTickers],
  };
}
