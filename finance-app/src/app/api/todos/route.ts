import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const todos = await prisma.todo.findMany({ orderBy: [{ done: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json(todos);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  const todo = await prisma.todo.create({
    data: { text: body.text, type: body.type ?? "untagged" },
  });
  return NextResponse.json(todo, { status: 201 });
}
