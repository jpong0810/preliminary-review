import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.done !== undefined) data.done = body.done;
  if (body.text !== undefined) data.text = body.text;
  if (body.type !== undefined) data.type = body.type;
  const todo = await prisma.todo.update({ where: { id: Number(id) }, data });
  return NextResponse.json(todo);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.todo.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
