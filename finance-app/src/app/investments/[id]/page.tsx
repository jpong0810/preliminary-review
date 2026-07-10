"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HoldingForm, type Account } from "@/components/HoldingForm";

type Thought = { id: number; date: string; text: string };

type HoldingDetail = {
  id: number;
  ticker: string;
  name: string;
  category: string;
  sector: string;
  geography: string;
  accountId: number;
  tags: string[];
  quantity: number;
  currency: string;
  price: number;
  fxRateToUsd: number;
  costBasis: number | null;
  notes: string | null;
  usdValue: number;
  thoughts: Thought[];
};

export default function HoldingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [holding, setHolding] = useState<HoldingDetail | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    Promise.all([fetch(`/api/holdings/${id}`).then((r) => r.json()), fetch("/api/accounts").then((r) => r.json())]).then(([h, a]) => {
      setHolding(h);
      setAccounts(a);
    });
  }, [id]);

  async function handleSave(values: Record<string, unknown>) {
    const res = await fetch(`/api/holdings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
    router.push("/investments");
  }

  async function handleDelete() {
    if (!confirm(`Delete ${holding?.ticker}? This can't be undone.`)) return;
    await fetch(`/api/holdings/${id}`, { method: "DELETE" });
    router.push("/investments");
  }

  if (!holding) return <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {holding.ticker} — {holding.name}
        </h1>
        <button onClick={handleDelete} className="text-xs font-medium px-3 py-1.5 rounded-md text-white" style={{ background: "var(--status-critical)" }}>
          Delete holding
        </button>
      </div>

      <HoldingForm
        accounts={accounts}
        initial={{
          ticker: holding.ticker,
          name: holding.name,
          category: holding.category,
          sector: holding.sector,
          geography: holding.geography,
          accountId: holding.accountId,
          tags: holding.tags.join(", "),
          quantity: holding.quantity,
          currency: holding.currency,
          price: holding.price,
          fxRateToUsd: holding.fxRateToUsd,
          costBasis: holding.costBasis ?? "",
          notes: holding.notes ?? "",
        }}
        onSubmit={handleSave}
        onCancel={() => router.push("/investments")}
      />

      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          Why I hold this
        </h3>
        {holding.thoughts.length === 0 ? (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            No thoughts link to this holding yet. Mention it in a thought and connect it from the Thoughts page.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {holding.thoughts.map((t) => (
              <li key={t.id} className="text-sm border-b pb-2" style={{ borderColor: "var(--gridline)" }}>
                <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
                  {new Date(t.date).toLocaleDateString()}
                </div>
                <Link href={`/thoughts?highlight=${t.id}`}>{t.text}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href={`/lineage?type=holding&id=${holding.id}`} className="text-sm font-medium" style={{ color: "var(--series-1)" }}>
        View full lineage thread →
      </Link>
    </div>
  );
}
