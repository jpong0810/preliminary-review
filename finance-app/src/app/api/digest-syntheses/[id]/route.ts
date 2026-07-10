import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["weekOf", "keyTakeaways", "consensusBullets", "newOrContrarianBullets", "actionItems", "sourceIds", "tags"]) {
    if (body[field] !== undefined) data[field] = field === "weekOf" ? new Date(body[field]) : body[field];
  }
  const synthesis = await prisma.digestSynthesis.update({ where: { id: Number(id) }, data });
  return NextResponse.json(synthesis);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.digestSynthesis.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
