import { prisma } from "./db";
import { inferThoughtMeta } from "./inference";

/**
 * Creates a new Thought from an existing Insight's text and links them; the insight is not
 * deleted. No relatedTickers here — thoughts have zero correlation to holdings, and an
 * Insight has no ticker data of its own to carry over; use update_thought afterward if the
 * promoted thought should track specific tickers.
 */
export async function promoteInsightToThought(insightId: number) {
  const insight = await prisma.insight.findUnique({ where: { id: insightId } });
  if (!insight) throw new Error("insight not found");

  const inferred = await inferThoughtMeta(insight.text, insight.tags);

  const thought = await prisma.thought.create({
    data: {
      date: new Date(),
      text: insight.text,
      tags: insight.tags.length ? insight.tags : inferred.tags,
      sentiment: inferred.sentiment,
    },
  });

  await prisma.insight.update({ where: { id: insightId }, data: { linkedThoughtId: thought.id } });

  return thought;
}
