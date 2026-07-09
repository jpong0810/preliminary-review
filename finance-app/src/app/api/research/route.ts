import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const research = await prisma.research.findMany({
    orderBy: { date: "desc" },
    select: { id: true, topic: true, summary: true, suggestion: true, tags: true, date: true, linkedThoughtId: true },
  });
  return NextResponse.json(research);
}

export async function POST(req: Request) {
  const body = await req.json();
  for (const field of ["topic", "thesisStatement", "summary", "suggestion", "deepDive"]) {
    if (!body[field]) return NextResponse.json({ error: `${field} is required` }, { status: 400 });
  }
  const research = await prisma.research.create({
    data: {
      topic: body.topic,
      thesisStatement: body.thesisStatement,
      date: body.date ? new Date(body.date) : new Date(),
      summary: body.summary,
      suggestion: body.suggestion,
      deepDive: body.deepDive,
      exposureOptions: body.exposureOptions ?? [],
      existingExposure: body.existingExposure ?? undefined,
      tags: body.tags ?? [],
      linkedThoughtId: body.linkedThoughtId ?? null,
      sources: body.sources ?? [],
    },
  });
  return NextResponse.json(research, { status: 201 });
}
