import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { usdValue, plNative, plPct } from "@/lib/holdings";

function serialize(h: Awaited<ReturnType<typeof prisma.holding.findFirst>>) {
  if (!h) return h;
  return { ...h, usdValue: usdValue(h), plNative: plNative(h), plPct: plPct(h) };
}

const EDITABLE_FIELDS = [
  "ticker",
  "name",
  "category",
  "sector",
  "geography",
  "geographyBreakdown",
  "accountId",
  "tags",
  "quantity",
  "currency",
  "price",
  "fxRateToUsd",
  "costBasis",
  "notes",
] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const holding = await prisma.holding.findUnique({
    where: { id: Number(id) },
    include: { account: true, thoughts: { select: { id: true, date: true, text: true } } },
  });
  if (!holding) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(serialize(holding));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = field === "ticker" ? String(body[field]).toUpperCase() : body[field];
  }
  if (data.accountId !== undefined) data.accountId = Number(data.accountId);
  if (data.quantity !== undefined) data.quantity = Number(data.quantity);
  if (data.price !== undefined) data.price = Number(data.price);
  if (data.fxRateToUsd !== undefined) data.fxRateToUsd = Number(data.fxRateToUsd);
  if (data.costBasis !== undefined) data.costBasis = data.costBasis === null ? null : Number(data.costBasis);

  const holding = await prisma.holding.update({ where: { id: Number(id) }, data });
  return NextResponse.json(serialize(holding));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.holding.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
