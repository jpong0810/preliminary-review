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
  // The only source of relatedTickers — explicit ticker/price data for whatever the thought
  // is actually about. No auto-matching against text or holdings; thoughts have zero
  // correlation to holdings by design.
  relatedTickerOverrides?: RelatedTicker[];
};

/** Shared by the web API and the MCP `add_thought` tool so inference behavior stays identical either way. */
export async function createThought(input: CreateThoughtInput) {
  const providedTags = input.tags ?? [];
  const inferred = await inferThoughtMeta(input.text, providedTags);
  const relatedTickers = input.relatedTickerOverrides ?? [];

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

export type UpdateThoughtInput = {
  text?: string;
  sentiment?: Sentiment;
  tags?: string[];
  relatedTickers?: RelatedTicker[];
  relatedHoldingIds?: number[];
  linkedResearchId?: number | null;
};

/**
 * Partial update, matched by id — e.g. to correct bad ticker matches without recreating
 * the entry (which would reset id/createdAt and corrupt the "captured at the time" record
 * the whole price-at-thought design depends on). date and createdAt are never accepted
 * here — there's no field in UpdateThoughtInput for either, so there's nothing to strip;
 * `updatedAt` (Prisma @updatedAt) records that an edit happened without disturbing them.
 * relatedTickers is fully explicit, same as createThought's relatedTickerOverrides — no
 * re-matching against text or holdings on update either.
 */
export async function updateThought(id: number, input: UpdateThoughtInput) {
  const data: Record<string, unknown> = {};
  if (input.text !== undefined) data.text = input.text;
  if (input.sentiment !== undefined) data.sentiment = input.sentiment;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.relatedTickers !== undefined) data.relatedTickers = input.relatedTickers.length ? input.relatedTickers : null;
  if (input.relatedHoldingIds !== undefined) data.relatedHoldingIds = input.relatedHoldingIds;
  if (input.linkedResearchId !== undefined) data.linkedResearchId = input.linkedResearchId;
  return prisma.thought.update({ where: { id }, data });
}

export type DeleteThoughtResult = { deletedId: number; warnings: string[] };

/**
 * Hard delete, matched by id. Calls/research/insights that reference this thought aren't
 * deleted (their FK just goes null, per the schema's onDelete: SetNull) but they do lose
 * that link — this returns a warning per dependent kind so the caller can flag it rather
 * than silently orphaning them.
 */
export async function deleteThought(id: number): Promise<DeleteThoughtResult> {
  const thought = await prisma.thought.findUnique({
    where: { id },
    include: { calls: true, seededResearch: true, insightsFrom: true },
  });
  if (!thought) throw new Error(`No thought with id ${id}.`);

  const warnings: string[] = [];
  if (thought.calls.length) {
    warnings.push(`${thought.calls.length} call(s) linked to this thought will lose that link (not deleted).`);
  }
  if (thought.seededResearch.length) {
    warnings.push(
      `${thought.seededResearch.length} research entr${thought.seededResearch.length === 1 ? "y" : "ies"} seeded from this thought will lose that link.`
    );
  }
  if (thought.insightsFrom.length) {
    warnings.push(`${thought.insightsFrom.length} insight(s) promoted from this thought will lose that link.`);
  }

  await prisma.thought.delete({ where: { id } });
  return { deletedId: id, warnings };
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
