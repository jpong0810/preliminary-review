import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const sources = await prisma.digestSource.findMany({ orderBy: { dateLogged: "desc" } });
  return NextResponse.json(sources);
}

export async function POST(req: Request) {
  const body = await req.json();
  for (const field of ["title", "sourceType", "date"]) {
    if (!body[field]) return NextResponse.json({ error: `${field} is required` }, { status: 400 });
  }
  const source = await prisma.digestSource.create({
    data: {
      title: body.title,
      speaker: body.speaker ?? null,
      sourceType: body.sourceType,
      url: body.url ?? null,
      date: new Date(body.date),
      dateLogged: new Date(),
      keyTakeaways: body.keyTakeaways ?? [],
      actionItems: body.actionItems ?? [],
      tags: body.tags ?? [],
    },
  });
  return NextResponse.json(source, { status: 201 });
}
