"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { DonutChart } from "@/components/charts/DonutChart";
import { BarChart } from "@/components/charts/BarChart";
import { StatCard } from "@/components/StatCard";
import { TagPills } from "@/components/TagPills";
import { HoldingForm, type Account } from "@/components/HoldingForm";
import { assetAllocationBucket, normalizedGeography } from "@/lib/holdings";

type HoldingDTO = {
  id: number;
  ticker: string;
  name: string;
  category: string;
  sector: string;
  geography: string;
  geographyBreakdown: { region: string; weight: number }[] | null;
  accountId: number;
  account?: Account;
  tags: string[];
  quantity: number;
  currency: string;
  price: number;
  fxRateToUsd: number;
  costBasis: number | null;
  notes: string | null;
  updatedAt: string;
  usdValue: number;
  plNative: number | null;
  plPct: number | null;
};

type ExposureEvaluation = {
  ruleId: number;
  label: string;
  metric: string;
  target: string;
  operator: string;
  threshold: number;
  actualPct: number;
  triggered: boolean;
};

type PriceRule = {
  id: number;
  label: string;
  ticker: string | null;
  description: string | null;
  lastStatus: string | null;
  lastChecked: string | null;
  lastNote: string | null;
};

const fmtUsd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function InvestmentsPage() {
  const [holdings, setHoldings] = useState<HoldingDTO[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<{ exposureEvaluations: ExposureEvaluation[]; priceRules: PriceRule[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overall" | number | "combined">("overall");
  const [combinedIds, setCombinedIds] = useState<number[]>([]);
  const [showCombinedPicker, setShowCombinedPicker] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<"ticker" | "usdValue" | "plPct">("usdValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountInstitution, setNewAccountInstitution] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  async function refresh() {
    const [h, a, r] = await Promise.all([
      fetch("/api/holdings").then((res) => res.json()),
      fetch("/api/accounts").then((res) => res.json()),
      fetch("/api/rules").then((res) => res.json()),
    ]);
    setHoldings(h);
    setAccounts(a);
    setRules(r);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const scoped = useMemo(() => {
    if (tab === "overall") return holdings;
    if (tab === "combined") return holdings.filter((h) => combinedIds.includes(h.accountId));
    return holdings.filter((h) => h.accountId === tab);
  }, [holdings, tab, combinedIds]);
  const totalUsd = useMemo(() => scoped.reduce((s, h) => s + h.usdValue, 0), [scoped]);

  const cashUsd = useMemo(
    () => scoped.filter((h) => h.category.toLowerCase() === "cash").reduce((s, h) => s + h.usdValue, 0),
    [scoped]
  );

  const assetAllocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of scoped) map.set(assetAllocationBucket(h), (map.get(assetAllocationBucket(h)) ?? 0) + h.usdValue);
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [scoped]);

  const geography = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of scoped) {
      for (const g of normalizedGeography(h)) {
        map.set(g.region, (map.get(g.region) ?? 0) + h.usdValue * (g.weight / 100));
      }
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [scoped]);

  const sector = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of scoped) map.set(h.sector, (map.get(h.sector) ?? 0) + h.usdValue);
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [scoped]);

  const byAccount = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      const name = accounts.find((a) => a.id === h.accountId)?.name ?? `#${h.accountId}`;
      map.set(name, (map.get(name) ?? 0) + h.usdValue);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [holdings, accounts]);

  const topHoldings = useMemo(
    () => [...scoped].sort((a, b) => b.usdValue - a.usdValue).slice(0, 10).map((h) => ({ label: h.ticker, value: h.usdValue })),
    [scoped]
  );

  const themeBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of scoped) for (const t of h.tags) map.set(t, (map.get(t) ?? 0) + h.usdValue);
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [scoped]);

  const filteredSortedHoldings = useMemo(() => {
    const q = filterText.toLowerCase();
    let list = scoped.filter((h) => {
      if (!q) return true;
      const accountName = accounts.find((a) => a.id === h.accountId)?.name ?? "";
      return (
        h.ticker.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        h.sector.toLowerCase().includes(q) ||
        h.geography.toLowerCase().includes(q) ||
        accountName.toLowerCase().includes(q) ||
        h.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "ticker") cmp = a.ticker.localeCompare(b.ticker);
      else if (sortKey === "usdValue") cmp = a.usdValue - b.usdValue;
      else cmp = (a.plPct ?? -Infinity) - (b.plPct ?? -Infinity);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [scoped, filterText, sortKey, sortDir, accounts]);

  function openCombined() {
    if (tab !== "combined") {
      setCombinedIds(accounts.map((a) => a.id)); // default to all accounts selected
      setTab("combined");
    }
    setShowCombinedPicker((s) => !s);
  }

  function toggleCombinedAccount(id: number) {
    setCombinedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  async function handleAddHolding(values: Record<string, unknown>) {
    const res = await fetch("/api/holdings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add holding");
    setShowAddForm(false);
    await refresh();
  }

  async function handleAddAccount() {
    if (!newAccountName.trim()) return;
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAccountName.trim(), institution: newAccountInstitution.trim() || null }),
    });
    if (!res.ok) return;
    setNewAccountName("");
    setNewAccountInstitution("");
    setShowAddAccount(false);
    await refresh();
  }

  async function quickEdit(id: number, field: string, value: string) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    await fetch(`/api/holdings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: num }) });
    await refresh();
  }

  async function checkRules() {
    setChecking(true);
    setCheckMsg(null);
    try {
      const res = await fetch("/api/rules/check", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setCheckMsg(data.error ?? "Check failed");
      } else {
        setCheckMsg(`Checked ${data.ruleResults?.length ?? 0} price rules, refreshed ${data.fxResults?.length ?? 0} FX rates.`);
      }
      await refresh();
    } finally {
      setChecking(false);
    }
  }

  if (loading) return <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 overflow-x-auto">
          <TabButton active={tab === "overall"} onClick={() => setTab("overall")}>
            Overall
          </TabButton>
          {accounts.map((a) => (
            <TabButton key={a.id} active={tab === a.id} onClick={() => setTab(a.id)}>
              {a.name}
            </TabButton>
          ))}
          <TabButton active={tab === "combined"} onClick={openCombined}>
            Combined {tab === "combined" ? "▾" : ""}
          </TabButton>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/holdings?format=csv" className="text-xs font-medium px-3 py-1.5 rounded-md card">
            Export CSV
          </a>
          <a href="/api/export/holdings?format=json" className="text-xs font-medium px-3 py-1.5 rounded-md card">
            Export JSON
          </a>
          <button onClick={() => setShowAddAccount((s) => !s)} className="text-xs font-medium px-3 py-1.5 rounded-md card">
            {showAddAccount ? "Close" : "+ Add account"}
          </button>
          <button onClick={() => setShowAddForm((s) => !s)} className="text-xs font-medium px-3 py-1.5 rounded-md text-white" style={{ background: "var(--series-1)" }}>
            {showAddForm ? "Close" : "+ Add holding"}
          </button>
        </div>
      </div>

      {tab === "combined" && showCombinedPicker && (
        <div className="card p-4">
          <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
            Choose which accounts to combine
          </div>
          <div className="flex flex-wrap gap-3">
            {accounts.map((a) => (
              <label key={a.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={combinedIds.includes(a.id)} onChange={() => toggleCombinedAccount(a.id)} />
                {a.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {showAddAccount && (
        <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Account name
            </span>
            <input
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="e.g. JP UBS"
              className="rounded-md border px-2 py-1.5 text-sm bg-transparent"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Institution (optional)
            </span>
            <input
              value={newAccountInstitution}
              onChange={(e) => setNewAccountInstitution(e.target.value)}
              placeholder="e.g. UBS"
              className="rounded-md border px-2 py-1.5 text-sm bg-transparent"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <button
            onClick={handleAddAccount}
            disabled={!newAccountName.trim()}
            className="text-sm font-medium px-4 py-1.5 rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--series-1)" }}
          >
            Save
          </button>
        </div>
      )}

      {showAddForm && <HoldingForm accounts={accounts} onSubmit={handleAddHolding} onCancel={() => setShowAddForm(false)} />}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Cash" value={fmtUsd(cashUsd)} sub={totalUsd > 0 ? `${((cashUsd / totalUsd) * 100).toFixed(1)}% of view` : undefined} />
        <StatCard label="Holdings" value={String(scoped.length)} />
        <StatCard label="Accounts" value={String(tab === "overall" ? accounts.length : tab === "combined" ? combinedIds.length : 1)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <DonutChart title="Asset allocation" data={assetAllocation} onSliceClick={(label) => setFilterText(label)} />
        <DonutChart title="Geography" data={geography} onSliceClick={(label) => setFilterText(label)} />
        <DonutChart title="Sector" data={sector} onSliceClick={(label) => setFilterText(label)} />
        {tab === "overall" ? (
          <BarChart title="By account" data={byAccount} onBarClick={(label) => {
            const acc = accounts.find((a) => a.name === label);
            if (acc) setTab(acc.id);
          }} />
        ) : (
          <BarChart title="Top holdings" data={topHoldings} onBarClick={(label) => {
            const h = scoped.find((x) => x.ticker === label);
            if (h) window.location.href = `/investments/${h.id}`;
          }} />
        )}
      </div>

      <BarChart title="Themes (by tag)" data={themeBars} onBarClick={(label) => setFilterText(label)} />

      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          Exposure &amp; price rules
        </h3>
        <div className="flex flex-col gap-2 mb-4">
          {rules?.exposureEvaluations.map((r) => (
            <div key={r.ruleId} className="flex items-center justify-between text-sm border-b py-1.5" style={{ borderColor: "var(--gridline)" }}>
              <span>{r.label}</span>
              <span
                className="font-medium px-2 py-0.5 rounded-full text-xs"
                style={{
                  background: r.triggered ? "var(--status-critical)" : "var(--status-good)",
                  color: "white",
                }}
              >
                {r.actualPct.toFixed(1)}% ({r.operator} {r.threshold}%)
              </span>
            </div>
          ))}
          {!rules?.exposureEvaluations.length && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No exposure rules yet.</div>}
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Price rules
          </span>
          <button onClick={checkRules} disabled={checking} className="text-xs font-medium px-3 py-1 rounded-md card disabled:opacity-50">
            {checking ? "Checking…" : "Check price rules"}
          </button>
        </div>
        {checkMsg && <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{checkMsg}</div>}
        <div className="flex flex-col gap-2">
          {rules?.priceRules.map((r) => (
            <div key={r.id} className="text-sm border-b py-1.5" style={{ borderColor: "var(--gridline)" }}>
              <div className="flex items-center justify-between">
                <span>
                  {r.label} — <span style={{ color: "var(--text-muted)" }}>{r.ticker}</span>
                </span>
                {r.lastStatus && (
                  <span
                    className="font-medium px-2 py-0.5 rounded-full text-xs text-white"
                    style={{ background: r.lastStatus === "triggered" ? "var(--status-critical)" : "var(--status-good)" }}
                  >
                    {r.lastStatus}
                  </span>
                )}
              </div>
              {r.lastNote && <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{r.lastNote}</div>}
            </div>
          ))}
          {!rules?.priceRules.length && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No price rules yet.</div>}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Holdings
          </h3>
          <input
            placeholder="Filter by ticker, name, sector, geography, account, tag…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="text-sm rounded-md border px-2 py-1 w-72 bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: "var(--gridline)", color: "var(--text-muted)" }}>
                <Th onClick={() => toggleSort("ticker")}>Ticker</Th>
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2">Account</th>
                <th className="py-2 px-2">Sector</th>
                <th className="py-2 px-2">Tags</th>
                <th className="py-2 px-2 text-right">Qty</th>
                <th className="py-2 px-2 text-right">Price</th>
                <Th onClick={() => toggleSort("usdValue")} align="right">
                  USD Value
                </Th>
                <Th onClick={() => toggleSort("plPct")} align="right">
                  P/L
                </Th>
              </tr>
            </thead>
            <tbody>
              {filteredSortedHoldings.map((h) => (
                <tr key={h.id} className="border-b hover:bg-black/[0.02]" style={{ borderColor: "var(--gridline)" }}>
                  <td className="py-2 px-2 font-medium">
                    <Link href={`/investments/${h.id}`} style={{ color: "var(--series-1)" }}>
                      {h.ticker}
                    </Link>
                  </td>
                  <td className="py-2 px-2">{h.name}</td>
                  <td className="py-2 px-2" style={{ color: "var(--text-secondary)" }}>
                    {accounts.find((a) => a.id === h.accountId)?.name}
                  </td>
                  <td className="py-2 px-2" style={{ color: "var(--text-secondary)" }}>
                    {h.sector}
                  </td>
                  <td className="py-2 px-2">
                    <TagPills tags={h.tags} />
                  </td>
                  <td className="py-2 px-2 text-right">
                    <input
                      defaultValue={h.quantity}
                      onBlur={(e) => quickEdit(h.id, "quantity", e.target.value)}
                      className="w-20 text-right bg-transparent rounded border px-1"
                      style={{ borderColor: "transparent" }}
                    />
                  </td>
                  <td className="py-2 px-2 text-right">
                    {h.currency !== "USD" ? `${h.currency} ` : "$"}
                    <input
                      defaultValue={h.price}
                      onBlur={(e) => quickEdit(h.id, "price", e.target.value)}
                      className="w-20 text-right bg-transparent rounded border px-1"
                      style={{ borderColor: "transparent" }}
                    />
                  </td>
                  <td className="py-2 px-2 text-right font-medium">{fmtUsd(h.usdValue)}</td>
                  <td
                    className="py-2 px-2 text-right font-medium"
                    style={{ color: h.plPct == null ? "var(--text-muted)" : h.plPct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}
                  >
                    {h.plPct == null ? "—" : `${(h.plPct * 100).toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx("px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap")}
      style={{ background: active ? "var(--series-1)" : "var(--surface-1)", color: active ? "white" : "var(--foreground)", border: "1px solid var(--border)" }}
    >
      {children}
    </button>
  );
}

function Th({ children, onClick, align = "left" }: { children: React.ReactNode; onClick: () => void; align?: "left" | "right" }) {
  return (
    <th className={clsx("py-2 px-2 cursor-pointer select-none", align === "right" && "text-right")} onClick={onClick}>
      {children}
    </th>
  );
}
