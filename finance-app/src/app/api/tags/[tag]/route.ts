import { NextResponse } from "next/server";
import { findByTag } from "@/lib/tags";

export async function GET(_req: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const results = await findByTag(decodeURIComponent(tag));
  return NextResponse.json(results);
}
