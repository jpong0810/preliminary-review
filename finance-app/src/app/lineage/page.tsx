"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type LineageNode = { type: string; id: number; date: string; label: string };

const NODE_HREF: Record<string, (id: number) => string> = {
  digest_source: (id) => `/digest#source-${id}`,
  insight: (id) => `/digest/insights#insight-${id}`,
  thought: (id) => `/thoughts?highlight=${id}`,
  research: (id) => `/research/${id}`,
  holding: (id) => `/investments/${id}`,
  call: (id) => `/digest/track-record#call-${id}`,
};

type PickerOption = { type: string; id: number; label: string };

function LineagePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  const [nodes, setNodes] = useState<LineageNode[] | null>(null);
  const [options, setOptions] = useState<PickerOption[]>([]);

  useEffect(() => {
    if (type && id) {
      setNodes(null);
      fetch(`/api/lineage/${type}/${id}`).then((r) => r.json()).then(setNodes);
    } else {
      Promise.all([
        fetch("/api/thoughts").then((r) => r.json()),
        fetch("/api/research").then((r) => r.json()),
        fetch("/api/holdings").then((r) => r.json()),
      ]).then(([thoughts, research, holdings]) => {
        setOptions([
          ...thoughts.slice(0, 15).map((t: { id: number; text: string }) => ({ type: "thought", id: t.id, label: t.text })),
          ...research.map((r: { id: number; topic: string }) => ({ type: "research", id: r.id, label: r.topic })),
          ...holdings.map((h: { id: number; ticker: string; name: string }) => ({ type: "holding", id: h.id, label: `${h.ticker} — ${h.name}` })),
        ]);
      });
    }
  }, [type, id]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Lineage / thread</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Experimental: walks the connections already tracked elsewhere (insight → thought → research → thought → holding) and shows them as one thread.
        </p>
      </div>

      {type && id && nodes && (
        <div className="card p-4">
          <button onClick={() => router.push("/lineage")} className="text-xs font-medium mb-3" style={{ color: "var(--series-1)" }}>
            ← Pick a different starting point
          </button>
          <div className="flex flex-col gap-2">
            {nodes.map((n, i) => (
              <div key={`${n.type}:${n.id}`} className="flex gap-3 items-start">
                <div className="flex flex-col items-center pt-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: "var(--series-1)" }} />
                  {i < nodes.length - 1 && <span className="w-px flex-1 mt-1" style={{ background: "var(--gridline)", minHeight: "20px" }} />}
                </div>
                <div className="pb-3">
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(n.date).toLocaleDateString()}
                  </div>
                  <Link href={NODE_HREF[n.type]?.(n.id) ?? "#"} className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {n.label}
                  </Link>
                </div>
              </div>
            ))}
            {nodes.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing connected to this yet.</div>}
          </div>
        </div>
      )}

      {!type && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
            Pick a starting point
          </h2>
          <ul className="flex flex-col gap-1.5 max-h-[500px] overflow-y-auto">
            {options.map((o) => (
              <li key={`${o.type}:${o.id}`}>
                <button
                  onClick={() => router.push(`/lineage?type=${o.type}&id=${o.id}`)}
                  className="text-sm text-left w-full py-1 hover:opacity-80 truncate"
                >
                  <span className="text-xs uppercase px-1.5 py-0.5 rounded mr-2" style={{ background: "var(--gridline)", color: "var(--text-muted)" }}>
                    {o.type}
                  </span>
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function LineagePage() {
  return (
    <Suspense fallback={<div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>}>
      <LineagePageInner />
    </Suspense>
  );
}
