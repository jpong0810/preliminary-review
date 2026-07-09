import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const syntheses = await prisma.digestSynthesis.findMany({ orderBy: { weekOf: "desc" } });
  return NextResponse.json(syntheses);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.weekOf) return NextResponse.json({ error: "weekOf is required" }, { status: 400 });
  const synthesis = await prisma.digestSynthesis.create({
    data: {
      weekOf: new Date(body.weekOf),
      keyTakeaways: body.keyTakeaways ?? [],
      consensusBullets: (body.consensusBullets ?? []).slice(0, 3),
      newOrContrarianBullets: (body.newOrContrarianBullets ?? []).slice(0, 3),
      actionItems: (body.actionItems ?? []).slice(0, 3),
      sourceIds: body.sourceIds ?? [],
      tags: body.tags ?? [],
    },
  });
  return NextResponse.json(synthesis, { status: 201 });
}
