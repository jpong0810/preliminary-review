import { prisma } from "./db";
import { lookupFxRate } from "./priceCheck";

export async function resolveAccountId(accountName?: string, accountId?: number): Promise<number> {
  if (accountId) return accountId;
  if (!accountName) throw new Error("Provide either accountId or account (account name).");
  const account = await prisma.account.findFirst({ where: { name: { equals: accountName, mode: "insensitive" } } });
  if (!account) {
    const all = await prisma.account.findMany({ select: { name: true } });
    throw new Error(`No account named "${accountName}". Existing accounts: ${all.map((a) => a.name).join(", ") || "(none yet)"}`);
  }
  return account.id;
}

/** Matches a holding by ticker + account, per the spec's disambiguation rule (same ticker can exist in multiple accounts). */
export async function findHoldingByTickerAndAccount(ticker: string, accountName?: string, accountId?: number) {
  const resolvedAccountId = await resolveAccountId(accountName, accountId);
  const holding = await prisma.holding.findFirst({
    where: { ticker: { equals: ticker, mode: "insensitive" }, accountId: resolvedAccountId },
  });
  if (!holding) {
    throw new Error(`No holding "${ticker}" found in that account.`);
  }
  return holding;
}

/** Looks up (via web_search, through the server's own Anthropic key) the current FX rate for a non-USD currency, when the caller didn't already supply one. */
export async function resolveFxRate(currency: string, providedRate?: number): Promise<number> {
  if (currency === "USD") return 1;
  if (providedRate != null) return providedRate;
  const rate = await lookupFxRate(currency);
  return rate ?? 1; // never silently invent a "real" rate — caller should treat this as needing a refresh
}
