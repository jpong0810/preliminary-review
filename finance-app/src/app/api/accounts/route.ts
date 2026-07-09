import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { holdings: true } } },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const account = await prisma.account.create({
    data: { name: body.name, institution: body.institution ?? null },
  });
  return NextResponse.json(account, { status: 201 });
}
