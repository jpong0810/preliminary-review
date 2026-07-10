"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Call = {
  id: number;
  originType: string;
  speaker: string;
  subject: string;
  direction: string;
  description: string;
  timeframe: string;
  dateMade: string;
  outcome: string | null;
  outcomeNote: string | null;
};

type SpeakerGroup = {
  speaker: string;
  calls: Call[];
  resolvedCount: number;
  correctCount: number;
  hitRate: number | null;
};

const OUTCOME_COLOR: Record<string, string> = {
  correct: "var(--status-good)",
  incorrect: "var(--status-critical)",
  mixed: "var(--status-warning)",
  "too-early-to-tell": "var(--text-muted)",
};

export default function TrackRecordPage() {
  const [groups, setGroups] = useState<SpeakerGroup[]>([]);

  async function refresh() {
    const groups = await fetch("/api/calls/track-record").then((r) => r.json());
    setGroups(groups);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function setOutcome(callId: number, outcome: string) {
    const note = prompt("Optional outcome note:") ?? undefined;
    await fetch(`/api/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, outcomeNote: note || undefined }),
    });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Track record</h1>
        <Link href="/digest" className="text-sm font-medium" style={{ color: "var(--series-1)" }}>
          ← Back to Digest
        </Link>
      </div>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Calls grouped by speaker — including your own self-made calls, in the same list as everyone else&apos;s.
      </p>

      {groups.map((g) => (
        <div key={g.speaker} className="card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{g.speaker === "me" ? "Me" : g.speaker}</span>
            {g.hitRate != null && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}>
                {g.correctCount}/{g.resolvedCount} resolved correct ({(g.hitRate * 100).toFixed(0)}%)
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {g.calls.map((c) => (
              <div key={c.id} id={`call-${c.id}`} className="text-sm border-b pb-2" style={{ borderColor: "var(--gridline)" }}>
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span>
                    <strong>{c.subject}</strong> — {c.description}
                  </span>
                  {c.outcome ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: OUTCOME_COLOR[c.outcome] }}>
                      {c.outcome}
                    </span>
                  ) : (
                    <select
                      defaultValue=""
                      onChange={(e) => e.target.value && setOutcome(c.id, e.target.value)}
                      className="text-xs rounded-md border px-1.5 py-1 bg-transparent"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <option value="">Set outcome…</option>
                      <option value="correct">Correct</option>
                      <option value="incorrect">Incorrect</option>
                      <option value="mixed">Mixed</option>
                      <option value="too-early-to-tell">Too early to tell</option>
                    </select>
                  )}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {c.timeframe} · made {new Date(c.dateMade).toLocaleDateString()}
                  {c.outcomeNote && <span> · {c.outcomeNote}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No calls logged yet.</div>}
    </div>
  );
}
