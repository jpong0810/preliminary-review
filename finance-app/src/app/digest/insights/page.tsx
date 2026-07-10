"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TagPills } from "@/components/TagPills";

type Insight = {
  id: number;
  text: string;
  note: string | null;
  tags: string[];
  dateSaved: string;
  linkedThoughtId: number | null;
  source?: { id: number; title: string } | null;
};

export default function SavedInsightsPage() {
  const router = useRouter();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [filterTag, setFilterTag] = useState("");
  const [newText, setNewText] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function refresh() {
    const url = filterTag ? `/api/insights?tag=${encodeURIComponent(filterTag)}` : "/api/insights";
    setInsights(await fetch(url).then((r) => r.json()));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTag]);

  async function addInsight() {
    if (!newText.trim()) return;
    await fetch("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: newText }) });
    setNewText("");
    setShowNew(false);
    await refresh();
  }

  async function promote(id: number) {
    await fetch(`/api/insights/${id}/promote`, { method: "POST" });
    router.push("/thoughts");
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Saved insights</h1>
        <Link href="/digest" className="text-sm font-medium" style={{ color: "var(--series-1)" }}>
          ← Back to Digest
        </Link>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <input
          placeholder="Filter by tag"
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="text-sm rounded-md border px-2 py-1 bg-transparent w-48"
          style={{ borderColor: "var(--border)" }}
        />
        <button onClick={() => setShowNew((s) => !s)} className="text-xs font-medium px-3 py-1.5 rounded-md text-white" style={{ background: "var(--series-1)" }}>
          {showNew ? "Close" : "+ New insight"}
        </button>
      </div>

      {showNew && (
        <div className="card p-3 flex gap-2">
          <input
            placeholder="A standalone point worth remembering…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="flex-1 text-sm rounded-md border px-2 py-1 bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />
          <button onClick={addInsight} className="text-xs font-medium px-3 py-1.5 rounded-md text-white" style={{ background: "var(--series-1)" }}>
            Save
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {insights.map((i) => (
          <div key={i.id} id={`insight-${i.id}`} className="card p-4 flex flex-col gap-1.5">
            <p className="text-sm">{i.text}</p>
            {i.note && (
              <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                {i.note}
              </p>
            )}
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                <TagPills tags={i.tags} />
                {i.source && <span className="text-xs" style={{ color: "var(--text-muted)" }}>from {i.source.title}</span>}
              </div>
              {i.linkedThoughtId ? (
                <Link href={`/thoughts?highlight=${i.linkedThoughtId}`} className="text-xs font-medium" style={{ color: "var(--series-1)" }}>
                  View promoted thought →
                </Link>
              ) : (
                <button onClick={() => promote(i.id)} className="text-xs font-medium" style={{ color: "var(--series-1)" }}>
                  Promote to thought
                </button>
              )}
            </div>
          </div>
        ))}
        {insights.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No saved insights yet.</div>}
      </div>
    </div>
  );
}
