"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";

type TagResults = {
  tag: string;
  holdings: { id: number; ticker: string; name: string; updatedAt: string }[];
  thoughts: { id: number; text: string; date: string }[];
  research: { id: number; topic: string; date: string }[];
  digestSources: { id: number; title: string; dateLogged: string }[];
  digestSyntheses: { id: number; weekOf: string }[];
  insights: { id: number; text: string; dateSaved: string }[];
  calls: { id: number; subject: string; description: string; dateMade: string }[];
};

export default function TagDetailPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = usePromise(params);
  const [results, setResults] = useState<TagResults | null>(null);

  useEffect(() => {
    fetch(`/api/tags/${encodeURIComponent(tag)}`).then((r) => r.json()).then(setResults);
  }, [tag]);

  if (!results) return <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const groups: { title: string; items: { href: string; label: string; date: string }[] }[] = [
    { title: "Holdings", items: results.holdings.map((h) => ({ href: `/investments/${h.id}`, label: `${h.ticker} — ${h.name}`, date: h.updatedAt })) },
    { title: "Thoughts", items: results.thoughts.map((t) => ({ href: `/thoughts?highlight=${t.id}`, label: t.text, date: t.date })) },
    { title: "Research", items: results.research.map((r) => ({ href: `/research/${r.id}`, label: r.topic, date: r.date })) },
    { title: "Digest sources", items: results.digestSources.map((s) => ({ href: `/digest#source-${s.id}`, label: s.title, date: s.dateLogged })) },
    { title: "Digest syntheses", items: results.digestSyntheses.map((s) => ({ href: `/digest`, label: `Week of ${new Date(s.weekOf).toLocaleDateString()}`, date: s.weekOf })) },
    { title: "Saved insights", items: results.insights.map((i) => ({ href: `/digest/insights#insight-${i.id}`, label: i.text, date: i.dateSaved })) },
    { title: "Calls", items: results.calls.map((c) => ({ href: `/digest/track-record#call-${c.id}`, label: `${c.subject} — ${c.description}`, date: c.dateMade })) },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">#{results.tag}</h1>
        <Link href="/tags" className="text-sm font-medium" style={{ color: "var(--series-1)" }}>
          ← All tags
        </Link>
      </div>
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <div key={g.title} className="card p-4">
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                {g.title} ({g.items.length})
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {g.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <Link href={it.href} className="truncate" style={{ color: "var(--foreground)" }}>
                      {it.label}
                    </Link>
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                      {new Date(it.date).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
      )}
      {groups.every((g) => g.items.length === 0) && <div className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing tagged with this yet.</div>}
    </div>
  );
}
