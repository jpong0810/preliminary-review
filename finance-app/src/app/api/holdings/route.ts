import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { usdValue, plNative, plPct } from "@/lib/holdings";

function serialize(h: Awaited<ReturnType<typeof prisma.holding.findFirst>>) {
  if (!h) return h;
  return { ...h, usdValue: usdValue(h), plNative: plNative(h), plPct: plPct(h) };
}

export async function GET() {
  const holdings = await prisma.holding.findMany({
    orderBy: { updatedAt: "desc" },
    include: { account: true },
  });
  return NextResponse.json(holdings.map(serialize));
}

export async function POST(req: Request) {
  const body = await req.json();
  for (const field of ["ticker", "name", "category", "sector", "geography", "accountId", "quantity", "price"]) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }
  const holding = await prisma.holding.create({
    data: {
      ticker: String(body.ticker).toUpperCase(),
      name: body.name,
      category: body.category,
      sector: body.sector,
      geography: body.geography,
      geographyBreakdown: body.geographyBreakdown ?? undefined,
      accountId: Number(body.accountId),
      tags: body.tags ?? [],
      quantity: Number(body.quantity),
      currency: body.currency ?? "USD",
      price: Number(body.price),
      fxRateToUsd: body.fxRateToUsd != null ? Number(body.fxRateToUsd) : 1,
      costBasis: body.costBasis != null ? Number(body.costBasis) : null,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(serialize(holding), { status: 201 });
}

export async function DELETE() {
  // delete-all-holdings, used by the MCP tool and an app "danger zone" action
  await prisma.holding.deleteMany({});
  return NextResponse.json({ ok: true });
}
