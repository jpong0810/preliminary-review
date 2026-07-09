import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag");
  const sourceId = searchParams.get("sourceId");
  const where: Record<string, unknown> = {};
  if (tag) where.tags = { has: tag };
  if (sourceId) where.sourceId = Number(sourceId);
  const insights = await prisma.insight.findMany({ where, orderBy: { dateSaved: "desc" }, include: { source: true } });
  return NextResponse.json(insights);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  const insight = await prisma.insight.create({
    data: {
      sourceId: body.sourceId ?? null,
      text: body.text,
      note: body.note ?? null,
      tags: body.tags ?? [],
      dateSaved: body.dateSaved ? new Date(body.dateSaved) : new Date(),
    },
  });
  return NextResponse.json(insight, { status: 201 });
}
