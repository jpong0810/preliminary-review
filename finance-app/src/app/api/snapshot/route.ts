import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/snapshot";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}
