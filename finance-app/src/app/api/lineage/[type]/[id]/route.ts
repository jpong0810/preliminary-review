import { NextResponse } from "next/server";
import { getLineage, type LineageNodeType } from "@/lib/lineage";

const VALID_TYPES: LineageNodeType[] = ["digest_source", "insight", "thought", "research", "holding", "call"];

export async function GET(_req: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (!VALID_TYPES.includes(type as LineageNodeType)) {
    return NextResponse.json({ error: `type must be one of ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }
  const nodes = await getLineage(type as LineageNodeType, Number(id));
  return NextResponse.json(nodes);
}
