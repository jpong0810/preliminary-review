import { prisma } from "./db";

export type TagResults = {
  tag: string;
  holdings: Awaited<ReturnType<typeof prisma.holding.findMany>>;
  thoughts: Awaited<ReturnType<typeof prisma.thought.findMany>>;
  research: Awaited<ReturnType<typeof prisma.research.findMany>>;
  digestSources: Awaited<ReturnType<typeof prisma.digestSource.findMany>>;
  digestSyntheses: Awaited<ReturnType<typeof prisma.digestSynthesis.findMany>>;
  insights: Awaited<ReturnType<typeof prisma.insight.findMany>>;
  calls: Awaited<ReturnType<typeof prisma.call.findMany>>;
};

/** Everything across every module that carries `tag`, grouped by module, newest first within each group. */
export async function findByTag(tag: string): Promise<TagResults> {
  const has = { has: tag };
  const [holdings, thoughts, research, digestSources, digestSyntheses, insights, calls] = await Promise.all([
    prisma.holding.findMany({ where: { tags: has }, orderBy: { updatedAt: "desc" } }),
    prisma.thought.findMany({ where: { tags: has }, orderBy: { date: "desc" } }),
    prisma.research.findMany({ where: { tags: has }, orderBy: { date: "desc" } }),
    prisma.digestSource.findMany({ where: { tags: has }, orderBy: { dateLogged: "desc" } }),
    prisma.digestSynthesis.findMany({ where: { tags: has }, orderBy: { weekOf: "desc" } }),
    prisma.insight.findMany({ where: { tags: has }, orderBy: { dateSaved: "desc" } }),
    prisma.call.findMany({ where: { tags: has }, orderBy: { dateMade: "desc" } }),
  ]);
  return { tag, holdings, thoughts, research, digestSources, digestSyntheses, insights, calls };
}

/** Every distinct tag currently in use across all modules, for populating tag pickers. */
export async function allTags(): Promise<string[]> {
  const [holdings, thoughts, research, digestSources, digestSyntheses, insights, calls] = await Promise.all([
    prisma.holding.findMany({ select: { tags: true } }),
    prisma.thought.findMany({ select: { tags: true } }),
    prisma.research.findMany({ select: { tags: true } }),
    prisma.digestSource.findMany({ select: { tags: true } }),
    prisma.digestSynthesis.findMany({ select: { tags: true } }),
    prisma.insight.findMany({ select: { tags: true } }),
    prisma.call.findMany({ select: { tags: true } }),
  ]);
  const set = new Set<string>();
  for (const group of [holdings, thoughts, research, digestSources, digestSyntheses, insights, calls]) {
    for (const row of group) for (const t of row.tags) set.add(t);
  }
  return Array.from(set).sort();
}
