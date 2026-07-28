import { prisma } from "./db";
import { inferThoughtMeta } from "./inference";
import type { Sentiment } from "./inference";
import type { RelatedTicker } from "./tickerMatch";

export type CreateThoughtInput = {
  text: string;
  date?: string | Date;
  tags?: string[];
  relatedHoldingIds?: number[];
  linkedResearchId?: number | null;
  sentiment?: Sentiment; // caller (Claude, in-conversation) may already know this; overrides inference when given
  // Explicit ticker/price data for stocks the text implies but that aren't currently held,
  // so auto-matching (which only resolves against held tickers) doesn't leave them out.
  // Takes priority over an auto-match of the same ticker.
  relatedTickerOverrides?: RelatedTicker[];
};

/** Shared by the web API and the MCP `add_thought` tool so inference behavior stays identical either way. */
export async function createThought(input: CreateThoughtInput) {
  const holdings = await prisma.holding.findMany();
  const providedTags = input.tags ?? [];
  const inferred = await inferThoughtMeta(input.text, holdings, providedTags);

  const mergedTickers = new Map<string, RelatedTicker>();
  for (const t of inferred.relatedTickers) mergedTickers.set(t.ticker.toUpperCase(), t);
  for (const t of input.relatedTickerOverrides ?? []) mergedTickers.set(t.ticker.toUpperCase(), t);
  const relatedTickers = Array.from(mergedTickers.values());

  return prisma.thought.create({
    data: {
      date: input.date ? new Date(input.date) : new Date(),
      text: input.text,
      tags: providedTags.length ? providedTags : inferred.tags,
      sentiment: input.sentiment ?? inferred.sentiment,
      relatedTickers: relatedTickers.length ? relatedTickers : undefined,
      relatedHoldingIds: input.relatedHoldingIds ?? [],
      linkedResearchId: input.linkedResearchId ?? null,
    },
  });
}

export type SearchThoughtsInput = {
  tag?: string;
  keyword?: string;
  from?: string;
  to?: string;
};

/** Filter by date range/tag/keyword — the scaling path for once the log outgrows get_snapshot's compact summary. */
export async function searchThoughts(filters: SearchThoughtsInput) {
  const where: Record<string, unknown> = {};
  if (filters.tag) where.tags = { has: filters.tag };
  if (filters.keyword) where.text = { contains: filters.keyword, mode: "insensitive" };
  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }
  return prisma.thought.findMany({ where, orderBy: { date: "desc" } });
}
