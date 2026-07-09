import { prisma } from "./db";
import { usdValue } from "./holdings";

/**
 * Compact portfolio + activity snapshot. Claude should call this first in a session to
 * resolve ticker/account ambiguity, avoid duplicate entries, and check digest takeaways
 * against real holdings so action items can name specific positions.
 */
export async function getSnapshot() {
  const [accounts, holdings, thoughts, research, todos, rules, calls, insights] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.holding.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.thought.findMany({ orderBy: { date: "desc" }, take: 20 }),
    prisma.research.findMany({ orderBy: { date: "desc" }, take: 20, select: { id: true, topic: true, summary: true, suggestion: true, tags: true, date: true } }),
    prisma.todo.findMany({ where: { done: false }, orderBy: { createdAt: "desc" } }),
    prisma.rule.findMany(),
    prisma.call.findMany({ orderBy: { dateMade: "desc" }, take: 20 }),
    prisma.insight.findMany({ orderBy: { dateSaved: "desc" }, take: 20 }),
  ]);

  return {
    accounts,
    holdings: holdings.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      category: h.category,
      sector: h.sector,
      geography: h.geography,
      accountId: h.accountId,
      tags: h.tags,
      quantity: h.quantity,
      currency: h.currency,
      price: h.price,
      fxRateToUsd: h.fxRateToUsd,
      usdValue: usdValue(h),
      costBasis: h.costBasis,
      updatedAt: h.updatedAt,
    })),
    recentThoughts: thoughts,
    researchTopics: research,
    openTodos: todos,
    rules,
    recentCalls: calls,
    recentInsights: insights,
  };
}
