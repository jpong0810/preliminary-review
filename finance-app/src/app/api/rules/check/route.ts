import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPriceRule, refreshFxRate } from "@/lib/priceCheck";

/** "Check price rules" action: runs a real web-search-backed check on every price rule
 * and refreshes fx_rate_to_usd for non-USD holdings in the same pass (same "on request,
 * not live" category of data). */
export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server — price/FX checks require it." },
      { status: 503 }
    );
  }

  const [priceRules, nonUsdHoldings] = await Promise.all([
    prisma.rule.findMany({ where: { ruleType: "price" } }),
    prisma.holding.findMany({ where: { NOT: { currency: "USD" } } }),
  ]);

  const ruleResults = [];
  for (const rule of priceRules) {
    const result = await checkPriceRule(rule);
    if (result) {
      await prisma.rule.update({
        where: { id: rule.id },
        data: { lastStatus: result.status, lastNote: result.note, lastChecked: new Date() },
      });
    }
    ruleResults.push({ ruleId: rule.id, ...result });
  }

  const fxResults = [];
  for (const holding of nonUsdHoldings) {
    const result = await refreshFxRate(holding);
    if (result) {
      await prisma.holding.update({ where: { id: holding.id }, data: { fxRateToUsd: result.fxRateToUsd } });
    }
    fxResults.push({ holdingId: holding.id, ticker: holding.ticker, ...result });
  }

  return NextResponse.json({ ruleResults, fxResults });
}
