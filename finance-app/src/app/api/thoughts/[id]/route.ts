import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateThought, deleteThought } from "@/lib/thoughts";

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
  const thought = await updateThought(Number(id), body);
  return NextResponse.json(thought);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteThought(Number(id));
  return NextResponse.json({ ok: true, warnings: result.warnings });
}
