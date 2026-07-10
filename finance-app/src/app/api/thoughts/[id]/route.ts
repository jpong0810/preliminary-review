import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const thought = await prisma.thought.findUnique({
    where: { id: Number(id) },
    include: { relatedHoldings: true, linkedResearch: true, seededResearch: true },
  });
  if (!thought) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(thought);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["text", "tags", "date", "relatedHoldingIds", "linkedResearchId", "relatedTickers", "sentiment"]) {
    if (body[field] !== undefined) data[field] = field === "date" ? new Date(body[field]) : body[field];
  }
  const thought = await prisma.thought.update({ where: { id: Number(id) }, data });
  return NextResponse.json(thought);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.thought.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
