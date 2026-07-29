"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

type ExposureStatus = "ok" | "close" | "breached" | "unmapped";
type RuleSection = "Allocation targets" | "Cash management" | "Stock-specific" | "Process/discipline";

type ExposureRule = {
  ruleId: number;
  label: string;
  metric: string;
  target: string;
  operator: "min" | "max";
  threshold: number;
  actualValue: number;
  unit: "pct" | "count";
  status: ExposureStatus;
  note: string;
  section: RuleSection;
  lastChecked: string | null;
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

const SECTIONS: RuleSection[] = ["Allocation targets", "Cash management", "Stock-specific", "Process/discipline"];

const STATUS_COLOR: Record<ExposureStatus, string> = {
  ok: "var(--status-good)",
  close: "var(--status-warning)",
  breached: "var(--status-critical)",
  unmapped: "var(--status-serious)",
};

const STATUS_LABEL: Record<ExposureStatus, string> = {
  ok: "OK",
  close: "Close",
  breached: "Breached",
  unmapped: "Needs mapping",
};

const STATUS_RANK: Record<ExposureStatus, number> = { breached: 0, unmapped: 1, close: 2, ok: 3 };

function fmtValue(rule: ExposureRule) {
  return rule.unit === "pct" ? `${rule.actualValue.toFixed(1)}%` : String(Math.round(rule.actualValue));
}

function fmtThreshold(rule: ExposureRule) {
  return rule.unit === "pct" ? `${rule.threshold}%` : String(rule.threshold);
}

function fmtDate(iso: string | null) {
  if (!iso) return "never checked";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function RulesPage() {
  const [exposureRules, setExposureRules] = useState<ExposureRule[]>([]);
  const [priceRules, setPriceRules] = useState<PriceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const data = await fetch("/api/rules/status").then((r) => r.json());
    setExposureRules(data.exposureRules);
    setPriceRules(data.priceRules);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function refreshNow() {
    setRefreshing(true);
    try {
      const data = await fetch("/api/rules/status", { method: "POST" }).then((r) => r.json());
      setExposureRules(data.exposureRules);
      setPriceRules(data.priceRules);
    } finally {
      setRefreshing(false);
    }
  }

  async function markReviewed(id: number, note: string) {
    await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastStatus: "ok", lastChecked: new Date().toISOString(), lastNote: note }),
    });
    await load();
  }

  const sections = useMemo(() => {
    const bySection = new Map<RuleSection, { exposure: ExposureRule[]; price: PriceRule[] }>();
    for (const s of SECTIONS) bySection.set(s, { exposure: [], price: [] });
    for (const r of exposureRules) bySection.get(r.section)!.exposure.push(r);
    for (const r of priceRules) bySection.get("Process/discipline")!.price.push(r);

    for (const bucket of bySection.values()) {
      bucket.exposure.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
      bucket.price.sort((a, b) => {
        const aTime = a.lastChecked ? new Date(a.lastChecked).getTime() : -1;
        const bTime = b.lastChecked ? new Date(b.lastChecked).getTime() : -1;
        return aTime - bTime;
      });
    }
    return bySection;
  }, [exposureRules, priceRules]);

  if (loading) return <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Rules</h1>
        <button
          onClick={refreshNow}
          disabled={refreshing}
          className="text-xs font-medium px-3 py-1.5 rounded-md card disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh now"}
        </button>
      </div>

      {SECTIONS.map((section) => {
        const bucket = sections.get(section)!;
        if (bucket.exposure.length === 0 && bucket.price.length === 0) return null;
        return (
          <div key={section} className="card p-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
              {section}
            </h3>
            <div className="flex flex-col gap-2">
              {bucket.exposure.map((r) => (
                <ExposureRuleRow key={r.ruleId} rule={r} />
              ))}
              {bucket.price.map((r) => (
                <ChecklistRuleCard key={r.id} rule={r} onMarkReviewed={markReviewed} />
              ))}
            </div>
          </div>
        );
      })}

      {exposureRules.length === 0 && priceRules.length === 0 && (
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>No rules saved yet.</div>
      )}
    </div>
  );
}

function ExposureRuleRow({ rule }: { rule: ExposureRule }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 text-sm" style={{ borderColor: "var(--gridline)" }}>
      <div className="min-w-0">
        <div className="font-medium truncate">{rule.label}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {rule.note} · as of {fmtDate(rule.lastChecked)}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {fmtValue(rule)} ({rule.operator} {fmtThreshold(rule)})
        </span>
        <span
          className="font-medium px-2 py-0.5 rounded-full text-xs text-white whitespace-nowrap"
          style={{ background: STATUS_COLOR[rule.status] }}
        >
          {STATUS_LABEL[rule.status]}
        </span>
      </div>
    </div>
  );
}

function ChecklistRuleCard({ rule, onMarkReviewed }: { rule: PriceRule; onMarkReviewed: (id: number, note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await onMarkReviewed(rule.id, note.trim());
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-b py-2 text-sm flex flex-col gap-2" style={{ borderColor: "var(--gridline)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">
            {rule.label}
            {rule.ticker && <span style={{ color: "var(--text-muted)" }}> — {rule.ticker}</span>}
          </div>
          {rule.description && (
            <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {rule.description}
            </div>
          )}
        </div>
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
          last reviewed {fmtDate(rule.lastChecked)}
        </span>
      </div>
      {rule.lastNote && (
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Note: {rule.lastNote}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <input
          placeholder="Add a review note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="flex-1 text-xs rounded-md border px-2 py-1 bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          onClick={submit}
          disabled={saving}
          className={clsx("text-xs font-medium px-2.5 py-1 rounded-md text-white disabled:opacity-50")}
          style={{ background: "var(--series-1)" }}
        >
          {saving ? "Saving…" : "Mark reviewed"}
        </button>
      </div>
    </div>
  );
}
