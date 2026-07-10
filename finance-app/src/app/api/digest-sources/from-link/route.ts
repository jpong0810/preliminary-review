import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { summarizeLinkForDigest } from "@/lib/digestFromLink";

/** Paste-a-link intake for the Digest page — reads the link and logs it as a source, for when no Claude conversation is open. */
export async function POST(req: Request) {
  const body = await req.json();
  if (!body.url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(body.url);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https links are supported." }, { status: 400 });
  }

  const holdings = await prisma.holding.findMany();

  let summary;
  try {
    summary = await summarizeLinkForDigest(url.toString(), holdings);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read that link.";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 422;
    return NextResponse.json({ error: message }, { status });
  }

  const source = await prisma.digestSource.create({
    data: {
      title: summary.title,
      speaker: summary.speaker,
      sourceType: summary.sourceType,
      url: url.toString(),
      date: new Date(summary.date),
      dateLogged: new Date(),
      keyTakeaways: summary.keyTakeaways,
      actionItems: summary.actionItems,
      tags: summary.tags,
    },
  });

  return NextResponse.json(source, { status: 201 });
}
