import { NextResponse } from "next/server";
import { inferThoughtMeta } from "@/lib/inference";

/**
 * Powers the in-app Thoughts quick-add box's live preview (tags/sentiment badges) when
 * the person is using the plain web app with no Claude conversation open. Uses a
 * server-held ANTHROPIC_API_KEY — never exposed to the client. No ticker inference here:
 * thoughts have zero correlation to holdings, and relatedTickers is explicit-input only.
 */
export async function POST(req: Request) {
  const body = await req.json();
  if (!body.text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  const inferred = await inferThoughtMeta(body.text, body.tags ?? []);
  return NextResponse.json(inferred);
}
