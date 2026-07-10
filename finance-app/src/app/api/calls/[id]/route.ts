import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Used to fill in outcome/outcome_note/outcome_reviewed_at on a later visit — never at creation time.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.outcome !== undefined) {
    data.outcome = body.outcome;
    data.outcomeReviewedAt = new Date();
  }
  if (body.outcomeNote !== undefined) data.outcomeNote = body.outcomeNote;
  for (const field of ["speaker", "subject", "direction", "description", "timeframe", "tags"]) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  const call = await prisma.call.update({ where: { id: Number(id) }, data });
  return NextResponse.json(call);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.call.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
