import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const account = await prisma.account.update({
    where: { id: Number(id) },
    data: { name: body.name, institution: body.institution ?? null },
  });
  return NextResponse.json(account);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.account.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
