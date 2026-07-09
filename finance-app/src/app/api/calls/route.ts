import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const calls = await prisma.call.findMany({ orderBy: { dateMade: "desc" } });
  return NextResponse.json(calls);
}

export async function POST(req: Request) {
  const body = await req.json();
  for (const field of ["originType", "speaker", "subject", "direction", "description", "timeframe", "dateMade"]) {
    if (!body[field]) return NextResponse.json({ error: `${field} is required` }, { status: 400 });
  }
  if (body.originType !== "digest" && body.originType !== "self") {
    return NextResponse.json({ error: "originType must be 'digest' or 'self'" }, { status: 400 });
  }
  const call = await prisma.call.create({
    data: {
      originType: body.originType,
      digestSourceId: body.digestSourceId ?? null,
      thoughtId: body.thoughtId ?? null,
      speaker: body.speaker,
      subject: body.subject,
      direction: body.direction,
      description: body.description,
      timeframe: body.timeframe,
      dateMade: new Date(body.dateMade),
      tags: body.tags ?? [],
    },
  });
  return NextResponse.json(call, { status: 201 });
}
