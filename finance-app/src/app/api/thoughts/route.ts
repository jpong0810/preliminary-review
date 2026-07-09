import { NextResponse } from "next/server";
import { createThought, searchThoughts } from "@/lib/thoughts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const thoughts = await searchThoughts({
    tag: searchParams.get("tag") ?? undefined,
    keyword: searchParams.get("q") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  return NextResponse.json(thoughts);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  const thought = await createThought(body);
  return NextResponse.json(thought, { status: 201 });
}
