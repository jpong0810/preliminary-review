import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluateExposureRulesDetailed } from "@/lib/rules";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** Recomputes every exposure rule live, and persists lastStatus/lastChecked/lastNote for any
 * rule whose lastChecked is null or >90 days old (or all of them, when `force` is set). */
async function refreshExposureRules(force: boolean) {
  const [rules, holdings] = await Promise.all([
    prisma.rule.findMany({ where: { ruleType: "exposure" } }),
    prisma.holding.findMany(),
  ]);
  const evaluations = evaluateExposureRulesDetailed(rules, holdings);
  const now = new Date();

  const stale = evaluations.filter((e) => {
    if (force) return true;
    const lastChecked = rules.find((r) => r.id === e.ruleId)?.lastChecked;
    return !lastChecked || now.getTime() - lastChecked.getTime() > NINETY_DAYS_MS;
  });

  await Promise.all(
    stale.map((e) => prisma.rule.update({ where: { id: e.ruleId }, data: { lastStatus: e.status, lastChecked: now, lastNote: e.note } }))
  );

  const staleIds = new Set(stale.map((e) => e.ruleId));
  return evaluations.map((e) => ({
    ...e,
    lastChecked: (staleIds.has(e.ruleId) ? now : rules.find((r) => r.id === e.ruleId)?.lastChecked ?? null)?.toISOString?.() ?? null,
  }));
}

async function payload(force: boolean) {
  const [exposureRules, priceRules] = await Promise.all([
    refreshExposureRules(force),
    prisma.rule.findMany({ where: { ruleType: "price" }, orderBy: { createdAt: "desc" } }),
  ]);
  return { exposureRules, priceRules };
}

export async function GET() {
  return NextResponse.json(await payload(false));
}

export async function POST() {
  return NextResponse.json(await payload(true));
}
