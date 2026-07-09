"use client";

import { useState } from "react";
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

export function LineageThread({ type, id, label = "Thread" }: { type: string; id: number; label?: string }) {
  const [open, setOpen] = useState(false);
  const [nodes, setNodes] = useState<LineageNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!open && !nodes) {
      setLoading(true);
      const res = await fetch(`/api/lineage/${type}/${id}`);
      setNodes(await res.json());
      setLoading(false);
    }
    setOpen((o) => !o);
  }

  return (
    <div>
      <button onClick={toggle} className="text-xs font-medium" style={{ color: "var(--series-1)" }}>
        {open ? "▾" : "▸"} {label}
      </button>
      {open && (
        <div className="mt-2 pl-3 border-l-2 flex flex-col gap-1.5" style={{ borderColor: "var(--gridline)" }}>
          {loading && <div className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</div>}
          {nodes?.length === 0 && <div className="text-xs" style={{ color: "var(--text-muted)" }}>Nothing connected yet.</div>}
          {nodes?.map((n) => (
            <div key={`${n.type}:${n.id}`} className="text-xs">
              <span style={{ color: "var(--text-muted)" }}>{new Date(n.date).toLocaleDateString()} — </span>
              <Link href={NODE_HREF[n.type]?.(n.id) ?? "#"} style={{ color: "var(--foreground)" }}>
                {n.label}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
