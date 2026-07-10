import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["label", "metric", "target", "operator", "threshold", "ticker", "description", "lastStatus", "lastChecked", "lastNote"]) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  const rule = await prisma.rule.update({ where: { id: Number(id) }, data });
  return NextResponse.json(rule);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.rule.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
