"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TagPills } from "@/components/TagPills";

type ResearchSummary = {
  id: number;
  topic: string;
  summary: string;
  suggestion: string;
  tags: string[];
  date: string;
};

const SUGGESTION_COLOR: Record<string, string> = {
  "worth a closer look": "var(--status-good)",
  "keep watching": "var(--status-warning)",
  "pass for now": "var(--text-muted)",
};

export default function ResearchListPage() {
  const [entries, setEntries] = useState<ResearchSummary[]>([]);

  useEffect(() => {
    fetch("/api/research").then((r) => r.json()).then(setEntries);
  }, []);

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Research library</h1>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          New entries are added by asking Claude to research a thesis — see the MCP connector.
        </span>
      </div>
      {entries.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No research entries yet.</div>}
      {entries.map((r) => (
        <Link key={r.id} href={`/research/${r.id}`} className="card p-4 flex flex-col gap-1.5 hover:opacity-90">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{r.topic}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: SUGGESTION_COLOR[r.suggestion] ?? "var(--text-muted)" }}>
              {r.suggestion}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {r.summary}
          </p>
          <div className="flex items-center justify-between mt-1">
            <TagPills tags={r.tags} linkToTagsView={false} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {new Date(r.date).toLocaleDateString()}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
