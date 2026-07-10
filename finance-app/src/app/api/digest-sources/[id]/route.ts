import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["title", "speaker", "sourceType", "url", "date", "keyTakeaways", "actionItems", "tags"]) {
    if (body[field] !== undefined) data[field] = field === "date" ? new Date(body[field]) : body[field];
  }
  const source = await prisma.digestSource.update({ where: { id: Number(id) }, data });
  return NextResponse.json(source);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.digestSource.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
