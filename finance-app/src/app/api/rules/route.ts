import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluateExposureRules } from "@/lib/rules";

export async function GET() {
  const [rules, holdings] = await Promise.all([prisma.rule.findMany({ orderBy: { createdAt: "desc" } }), prisma.holding.findMany()]);
  const evaluations = evaluateExposureRules(rules, holdings);
  const priceRules = rules.filter((r) => r.ruleType === "price");
  return NextResponse.json({ exposureEvaluations: evaluations, priceRules });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.ruleType === "exposure") {
    if (!body.metric || !body.target || !body.operator || body.threshold == null || !body.label) {
      return NextResponse.json({ error: "metric, target, operator, threshold, label are required for exposure rules" }, { status: 400 });
    }
    const rule = await prisma.rule.create({
      data: {
        ruleType: "exposure",
        label: body.label,
        metric: body.metric,
        target: body.target,
        operator: body.operator,
        threshold: Number(body.threshold),
      },
    });
    return NextResponse.json(rule, { status: 201 });
  }
  if (body.ruleType === "price") {
    if (!body.ticker || !body.description || !body.label) {
      return NextResponse.json({ error: "ticker, description, label are required for price rules" }, { status: 400 });
    }
    const rule = await prisma.rule.create({
      data: {
        ruleType: "price",
        label: body.label,
        ticker: String(body.ticker).toUpperCase(),
        description: body.description,
        lastStatus: null,
      },
    });
    return NextResponse.json(rule, { status: 201 });
  }
  return NextResponse.json({ error: "ruleType must be 'exposure' or 'price'" }, { status: 400 });
}
