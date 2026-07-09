"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { TagPills } from "@/components/TagPills";
import { LineageThread } from "@/components/LineageThread";

type ExposureOption = {
  vehicle: string;
  rationale: string[];
  accuracyScore: number;
  derivativeTier: number;
  note?: string;
};

type ResearchDetail = {
  id: number;
  topic: string;
  thesisStatement: string;
  date: string;
  summary: string;
  suggestion: string;
  deepDive: string;
  exposureOptions: ExposureOption[];
  existingExposure: { summary: string; holdingIds: number[] } | null;
  tags: string[];
  sources: { title: string; url?: string }[];
  linkedThought: { id: number; text: string; date: string } | null;
  spawnedThoughts: { id: number; text: string; date: string }[];
};

export default function ResearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [entry, setEntry] = useState<ResearchDetail | null>(null);
  const [loggingThought, setLoggingThought] = useState(false);

  useEffect(() => {
    fetch(`/api/research/${id}`).then((r) => r.json()).then(setEntry);
  }, [id]);

  async function logThoughtFromThis() {
    if (!entry) return;
    const topPick = [...entry.exposureOptions].sort((a, b) => b.accuracyScore - a.accuracyScore)[0];
    const seedText = topPick
      ? `${entry.suggestion} on "${entry.topic}" — leaning toward ${topPick.vehicle} for exposure.`
      : `${entry.suggestion} on "${entry.topic}".`;
    const text = prompt("Edit this down to your actual take before logging it as a thought:", seedText);
    if (!text) return;
    setLoggingThought(true);
    try {
      await fetch("/api/thoughts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, linkedResearchId: entry.id }),
      });
      router.push("/thoughts");
    } finally {
      setLoggingThought(false);
    }
  }

  if (!entry) return <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold">{entry.topic}</h1>
          <button
            onClick={logThoughtFromThis}
            disabled={loggingThought}
            className="text-xs font-medium px-3 py-1.5 rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--series-1)" }}
          >
            Log a thought from this
          </button>
        </div>
        <p className="text-sm italic mt-1" style={{ color: "var(--text-secondary)" }}>
          &ldquo;{entry.thesisStatement}&rdquo;
        </p>
        <div className="mt-2">
          <TagPills tags={entry.tags} />
        </div>
      </div>

      <div className="card p-5 prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
        <ReactMarkdown>{entry.deepDive}</ReactMarkdown>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          Exposure options
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...entry.exposureOptions]
            .sort((a, b) => a.derivativeTier - b.derivativeTier || b.accuracyScore - a.accuracyScore)
            .map((opt, i) => (
              <div key={i} className="card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{opt.vehicle}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}>
                    Tier {opt.derivativeTier}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--gridline)" }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${opt.accuracyScore * 10}%`, background: opt.accuracyScore >= 6 ? "var(--status-good)" : "var(--status-warning)" }}
                    />
                  </div>
                  <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {opt.accuracyScore}/10
                  </span>
                </div>
                <ul className="text-xs list-disc pl-4 flex flex-col gap-1" style={{ color: "var(--text-secondary)" }}>
                  {opt.rationale.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
                {opt.note && (
                  <div className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                    {opt.note}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {entry.existingExposure && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
            Existing exposure
          </h3>
          <p className="text-sm">{entry.existingExposure.summary}</p>
        </div>
      )}

      {entry.sources.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
            Sources
          </h3>
          <ul className="text-sm flex flex-col gap-1">
            {entry.sources.map((s, i) => (
              <li key={i}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--series-1)" }}>
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
          Thought lineage
        </h3>
        {entry.linkedThought && (
          <div className="text-sm mb-2">
            Seeded by:{" "}
            <Link href={`/thoughts?highlight=${entry.linkedThought.id}`} style={{ color: "var(--series-1)" }}>
              &ldquo;{entry.linkedThought.text}&rdquo;
            </Link>
          </div>
        )}
        {entry.spawnedThoughts.length > 0 && (
          <ul className="text-sm flex flex-col gap-1">
            {entry.spawnedThoughts.map((t) => (
              <li key={t.id}>
                <Link href={`/thoughts?highlight=${t.id}`} style={{ color: "var(--series-1)" }}>
                  {new Date(t.date).toLocaleDateString()} — &ldquo;{t.text}&rdquo;
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!entry.linkedThought && entry.spawnedThoughts.length === 0 && (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            No thoughts connected yet.
          </div>
        )}
        <div className="mt-2">
          <LineageThread type="research" id={entry.id} label="Full lineage thread" />
        </div>
      </div>
    </div>
  );
}
