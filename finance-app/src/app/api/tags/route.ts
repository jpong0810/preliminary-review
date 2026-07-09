import { NextResponse } from "next/server";
import { allTags } from "@/lib/tags";

export async function GET() {
  const tags = await allTags();
  return NextResponse.json(tags);
}
