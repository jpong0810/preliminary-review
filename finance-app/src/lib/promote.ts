import { prisma } from "./db";
import { inferThoughtMeta } from "./inference";

/** Creates a new Thought from an existing Insight's text and links them; the insight is not deleted. */
export async function promoteInsightToThought(insightId: number) {
  const insight = await prisma.insight.findUnique({ where: { id: insightId } });
  if (!insight) throw new Error("insight not found");

  const holdings = await prisma.holding.findMany();
  const inferred = await inferThoughtMeta(insight.text, holdings, insight.tags);

  const thought = await prisma.thought.create({
    data: {
      date: new Date(),
      text: insight.text,
      tags: insight.tags.length ? insight.tags : inferred.tags,
      sentiment: inferred.sentiment,
      relatedTickers: inferred.relatedTickers.length ? inferred.relatedTickers : undefined,
    },
  });

  await prisma.insight.update({ where: { id: insightId }, data: { linkedThoughtId: thought.id } });

  return thought;
}
