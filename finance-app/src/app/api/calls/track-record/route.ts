import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Groups calls by speaker (self-made calls included, same list as pundits) with a hit-rate once enough resolved calls exist. */
export async function GET() {
  const calls = await prisma.call.findMany({ orderBy: { dateMade: "desc" } });
  const bySpeaker = new Map<string, typeof calls>();
  for (const c of calls) {
    const list = bySpeaker.get(c.speaker) ?? [];
    list.push(c);
    bySpeaker.set(c.speaker, list);
  }

  const groups = Array.from(bySpeaker.entries()).map(([speaker, speakerCalls]) => {
    const resolved = speakerCalls.filter((c) => c.outcome && c.outcome !== "too-early-to-tell");
    const correct = resolved.filter((c) => c.outcome === "correct").length;
    return {
      speaker,
      calls: speakerCalls,
      resolvedCount: resolved.length,
      correctCount: correct,
      hitRate: resolved.length >= 3 ? correct / resolved.length : null,
    };
  });

  groups.sort((a, b) => b.calls.length - a.calls.length);
  return NextResponse.json(groups);
}
