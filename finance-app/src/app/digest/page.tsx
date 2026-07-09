"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TagPills } from "@/components/TagPills";

type Synthesis = {
  id: number;
  weekOf: string;
  keyTakeaways: string[];
  consensusBullets: string[];
  newOrContrarianBullets: string[];
  actionItems: string[];
  sourceIds: number[];
  tags: string[];
};

type Source = {
  id: number;
  title: string;
  speaker: string | null;
  sourceType: string;
  url: string | null;
  date: string;
  dateLogged: string;
  keyTakeaways: string[];
  actionItems: string[];
  tags: string[];
};

function isStale(source: Source): boolean {
  const days = (new Date(source.dateLogged).getTime() - new Date(source.date).getTime()) / 86400000;
  return days >= 14;
}

export default function DigestPage() {
  const [syntheses, setSyntheses] = useState<Synthesis[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/digest-syntheses").then((r) => r.json()), fetch("/api/digest-sources").then((r) => r.json())]).then(([s, src]) => {
      setSyntheses(s);
      setSources(src);
    });
  }, []);

  const filteredSyntheses = useMemo(
    () => syntheses.filter((s) => !filter || s.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase())) || s.keyTakeaways.some((k) => k.toLowerCase().includes(filter.toLowerCase()))),
    [syntheses, filter]
  );
  const filteredSources = useMemo(
    () =>
      sources.filter(
        (s) =>
          !filter ||
          s.title.toLowerCase().includes(filter.toLowerCase()) ||
          (s.speaker ?? "").toLowerCase().includes(filter.toLowerCase()) ||
          s.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase()))
      ),
    [sources, filter]
  );

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Digest</h1>
        <div className="flex gap-3 text-sm font-medium">
          <Link href="/digest/track-record" style={{ color: "var(--series-1)" }}>
            Track record →
          </Link>
          <Link href="/digest/insights" style={{ color: "var(--series-1)" }}>
            Saved insights →
          </Link>
        </div>
      </div>
      <input
        placeholder="Filter across sources and syntheses…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="text-sm rounded-md border px-3 py-2 bg-transparent"
        style={{ borderColor: "var(--border)" }}
      />

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Weekly syntheses
        </h2>
        {filteredSyntheses.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No syntheses logged yet.</div>}
        {[...filteredSyntheses].reverse().map((s) => (
          <div key={s.id} className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">Week of {new Date(s.weekOf).toLocaleDateString()}</span>
              <TagPills tags={s.tags} />
            </div>
            <div>
              <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                Key takeaways
              </h4>
              <ul className="text-sm list-disc pl-4 flex flex-col gap-1">
                {s.keyTakeaways.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                  Consensus / big calls
                </h4>
                <ul className="text-sm list-disc pl-4 flex flex-col gap-1" style={{ color: "var(--text-secondary)" }}>
                  {s.consensusBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                  New / contrarian
                </h4>
                <ul className="text-sm list-disc pl-4 flex flex-col gap-1" style={{ color: "var(--text-secondary)" }}>
                  {s.newOrContrarianBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
            {s.actionItems.length > 0 && (
              <div className="rounded-md p-2" style={{ background: "var(--gridline)" }}>
                <h4 className="text-xs font-semibold mb-1">Action items</h4>
                <ul className="text-sm list-disc pl-4">
                  {s.actionItems.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Sources
        </h2>
        {filteredSources.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No sources logged yet.</div>}
        {[...filteredSources].reverse().map((s) => (
          <div key={s.id} id={`source-${s.id}`} className="card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div>
                <span className="font-semibold text-sm">{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}</span>
                {s.speaker && <span className="text-sm" style={{ color: "var(--text-secondary)" }}> — {s.speaker}</span>}
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {s.sourceType} · {new Date(s.date).toLocaleDateString()}
                {isStale(s) && <span style={{ color: "var(--status-warning)" }}> · recorded {new Date(s.date).toLocaleDateString()} — several weeks old</span>}
              </span>
            </div>
            <ul className="text-sm list-disc pl-4 flex flex-col gap-1">
              {s.keyTakeaways.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
            {s.actionItems.length > 0 && (
              <div className="rounded-md p-2" style={{ background: "var(--gridline)" }}>
                <h4 className="text-xs font-semibold mb-1">Action items</h4>
                <ul className="text-sm list-disc pl-4">
                  {s.actionItems.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            <TagPills tags={s.tags} />
          </div>
        ))}
      </div>
    </div>
  );
}
