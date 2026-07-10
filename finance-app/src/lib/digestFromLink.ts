import Anthropic from "@anthropic-ai/sdk";
import type { Holding } from "@prisma/client";

function client(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export type LinkDigestResult = {
  title: string;
  speaker: string | null;
  sourceType: "podcast" | "video" | "article";
  date: string; // ISO — the content's real publish/recording date, not today
  keyTakeaways: string[];
  actionItems: string[];
  tags: string[];
};

/**
 * Reads a pasted link (article/video/podcast page) and turns it into digest-source
 * fields, the same way Claude would in a conversation — for when the person is on a
 * computer with no Claude conversation open. Requires ANTHROPIC_API_KEY.
 */
export async function summarizeLinkForDigest(url: string, holdings: Holding[]): Promise<LinkDigestResult> {
  const anthropic = client();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server — reading links requires it.");
  }

  const holdingsList = holdings.map((h) => `${h.ticker} (${h.name})`).join(", ") || "(no holdings yet)";

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 } as unknown as Anthropic.Tool],
    messages: [
      {
        role: "user",
        content:
          `Fetch and read this URL: ${url}\n\n` +
          `Determine the title, speaker/author (null if not identifiable), source_type ("podcast", "video", or "article"), ` +
          `and the content's ACTUAL publish/recording date (not today's date — find the real date on the page).\n\n` +
          `Then write exactly 5 key_takeaways from a long-term investor's perspective — favor structural/durable implications ` +
          `(moat risk, regime shifts, capex validation, competitive positioning) over headline-level recaps.\n\n` +
          `Then write 0-2 action_items: only include one if it genuinely connects to one of these current holdings — ` +
          `${holdingsList} — and name the specific ticker. Never force a generic action item; an empty array is correct when nothing connects.\n\n` +
          `Also return 2-4 short lowercase topic tags.\n\n` +
          `Return ONLY compact JSON, no other text: {"title": string, "speaker": string|null, "source_type": "podcast"|"video"|"article", ` +
          `"date": "YYYY-MM-DD", "key_takeaways": string[], "action_items": string[], "tags": string[]}`,
      },
    ],
  });

  const textBlock = [...msg.content].reverse().find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Couldn't read that link — no readable content came back.");
  }
  const match = textBlock.text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Couldn't make sense of that link's content.");
  }
  const parsed = JSON.parse(match[0]);

  if (!parsed.title || !parsed.source_type || !parsed.date) {
    throw new Error("That link didn't return enough information to log as a source.");
  }

  return {
    title: parsed.title,
    speaker: parsed.speaker ?? null,
    sourceType: ["podcast", "video", "article"].includes(parsed.source_type) ? parsed.source_type : "article",
    date: parsed.date,
    keyTakeaways: Array.isArray(parsed.key_takeaways) ? parsed.key_takeaways : [],
    actionItems: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}
