"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function TagsPage() {
  const [tags, setTags] = useState<string[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then(setTags);
  }, []);

  const visible = tags.filter((t) => t.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h1 className="text-xl font-bold">Tags</h1>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Pick a tag to see everything across the app that carries it — holdings, thoughts, research, digest sources/insights, and calls.
      </p>
      <input
        placeholder="Search tags…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="text-sm rounded-md border px-3 py-2 bg-transparent"
        style={{ borderColor: "var(--border)" }}
      />
      <div className="flex flex-wrap gap-2">
        {visible.map((t) => (
          <Link
            key={t}
            href={`/tags/${encodeURIComponent(t)}`}
            className="text-sm px-3 py-1.5 rounded-full card hover:opacity-80"
          >
            {t}
          </Link>
        ))}
        {visible.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No tags yet.</div>}
      </div>
    </div>
  );
}
