import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["text", "note", "tags"]) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  const insight = await prisma.insight.update({ where: { id: Number(id) }, data });
  return NextResponse.json(insight);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.insight.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
