import { NextResponse } from "next/server";
import { promoteInsightToThought } from "@/lib/promote";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const thought = await promoteInsightToThought(Number(id));
    return NextResponse.json(thought, { status: 201 });
  } catch {
    return NextResponse.json({ error: "insight not found" }, { status: 404 });
  }
}
