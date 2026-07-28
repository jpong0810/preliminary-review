import { NextResponse } from "next/server";
import { lookupCurrentPrice } from "@/lib/priceCheck";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  const currency = searchParams.get("currency") ?? undefined;
  if (!ticker) return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  const price = await lookupCurrentPrice(ticker, currency);
  if (price == null) return NextResponse.json({ error: `Couldn't find a current price for ${ticker}` }, { status: 404 });
  return NextResponse.json({ ticker, price });
}
