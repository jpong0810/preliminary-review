import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const research = await prisma.research.findUnique({
    where: { id: Number(id) },
    include: { linkedThought: true, spawnedThoughts: true },
  });
  if (!research) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(research);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["topic", "thesisStatement", "summary", "suggestion", "deepDive", "exposureOptions", "existingExposure", "tags", "sources"]) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  const research = await prisma.research.update({ where: { id: Number(id) }, data });
  return NextResponse.json(research);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.research.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
