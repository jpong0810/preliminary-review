import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { usdValue, plNative } from "@/lib/holdings";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";

  const holdings = await prisma.holding.findMany({ include: { account: true }, orderBy: { ticker: "asc" } });
  const rows = holdings.map((h) => ({
    ticker: h.ticker,
    name: h.name,
    category: h.category,
    sector: h.sector,
    geography: h.geography,
    account: h.account.name,
    tags: h.tags.join("|"),
    quantity: h.quantity,
    currency: h.currency,
    price: h.price,
    fxRateToUsd: h.fxRateToUsd,
    usdValue: usdValue(h),
    costBasis: h.costBasis,
    plNative: plNative(h),
    notes: h.notes ?? "",
    updatedAt: h.updatedAt.toISOString(),
  }));

  if (format === "json") {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=holdings.json" },
    });
  }

  const header = Object.keys(rows[0] ?? { ticker: "" }).join(",");
  const body = rows.map((r) => Object.values(r).map(csvEscape).join(",")).join("\n");
  return new NextResponse([header, body].filter(Boolean).join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=holdings.csv",
    },
  });
}
