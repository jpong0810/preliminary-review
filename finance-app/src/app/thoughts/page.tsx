"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TagPills } from "@/components/TagPills";
import { sentimentColor, SentimentDot } from "@/components/SentimentDot";
import { LineageThread } from "@/components/LineageThread";

type RelatedTicker = { ticker: string; price: number; currency?: string };

function fmtTickerPrice(rt: RelatedTicker): string {
  return rt.currency && rt.currency !== "USD" ? `${rt.price} ${rt.currency}` : `$${rt.price}`;
}

// Heuristic split at the first sentence boundary: a short one-liner stays whole (no
// commentary shown), while a longer entry gets its first sentence as the bold headline
// and everything after as de-emphasized supporting commentary (e.g. price/rationale
// detail). No new data field — this is purely a render-time split of the one `text` field.
function splitThoughtText(text: string): { headline: string; commentary: string | null } {
  const idx = text.indexOf(". ");
  if (idx === -1 || idx > text.length - 3) return { headline: text, commentary: null };
  return { headline: text.slice(0, idx + 1), commentary: text.slice(idx + 2).trim() || null };
}
type Thought = {
  id: number;
  date: string;
  text: string;
  tags: string[];
  sentiment: "bullish" | "bearish" | "neutral";
  relatedTickers: RelatedTicker[] | null;
  relatedHoldingIds: number[];
  linkedResearchId: number | null;
};
type Holding = { id: number; ticker: string; name: string };

function quarterOf(dateStr: string): string {
  const d = new Date(dateStr);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function quarterSortKey(label: string): number {
  const [q, y] = label.split(" ");
  return Number(y) * 10 + Number(q.slice(1));
}

function ThoughtsPageInner() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [view, setView] = useState<"list" | "timeline">("list");
  const [filterTag, setFilterTag] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [quickText, setQuickText] = useState("");
  const [quickTags, setQuickTags] = useState("");
  const [preview, setPreview] = useState<{ sentiment: string; tags: string[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    const [t, h] = await Promise.all([fetch("/api/thoughts").then((r) => r.json()), fetch("/api/holdings").then((r) => r.json())]);
    setThoughts(t);
    setHoldings(h);
  }

  useEffect(() => {
    refresh();
  }, []);

  // Debounced live preview of tags/sentiment badges as the person types.
  useEffect(() => {
    if (!quickText.trim()) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/infer-thought", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: quickText, tags: quickTags.split(",").map((t) => t.trim()).filter(Boolean) }),
        });
        setPreview(await res.json());
      } finally {
        setPreviewLoading(false);
      }
    }, 700);
    return () => clearTimeout(handle);
  }, [quickText, quickTags]);

  async function submitThought() {
    if (!quickText.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/thoughts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: quickText, tags: quickTags.split(",").map((t) => t.trim()).filter(Boolean) }),
      });
      setQuickText("");
      setQuickTags("");
      setPreview(null);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function linkHolding(thoughtId: number, holdingId: number) {
    const t = thoughts.find((x) => x.id === thoughtId);
    if (!t) return;
    const relatedHoldingIds = t.relatedHoldingIds.includes(holdingId) ? t.relatedHoldingIds : [...t.relatedHoldingIds, holdingId];
    await fetch(`/api/thoughts/${thoughtId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relatedHoldingIds }),
    });
    await refresh();
  }

  const filtered = useMemo(() => {
    return thoughts.filter((t) => {
      if (filterTag && !t.tags.includes(filterTag)) return false;
      if (filterKeyword && !t.text.toLowerCase().includes(filterKeyword.toLowerCase())) return false;
      return true;
    });
  }, [thoughts, filterTag, filterKeyword]);

  const byQuarter = useMemo(() => {
    const map = new Map<string, Thought[]>();
    for (const t of filtered) {
      const q = quarterOf(t.date);
      const list = map.get(q) ?? [];
      list.push(t);
      map.set(q, list);
    }
    return Array.from(map.entries()).sort((a, b) => quarterSortKey(a[0]) - quarterSortKey(b[0]));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="card p-4 flex flex-col gap-2">
        <textarea
          placeholder="What's on your mind? (e.g. 'buy after a big dip, Trump unlikely to hold out for a long war')"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          rows={2}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            placeholder="Tags (optional, comma-separated)"
            value={quickTags}
            onChange={(e) => setQuickTags(e.target.value)}
            className="text-sm rounded-md border px-2 py-1 bg-transparent flex-1 min-w-[180px]"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={submitThought}
            disabled={submitting || !quickText.trim()}
            className="text-sm font-medium px-4 py-1.5 rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--series-1)" }}
          >
            {submitting ? "Saving…" : "Log thought"}
          </button>
        </div>
        {previewLoading && <div className="text-xs" style={{ color: "var(--text-muted)" }}>Inferring tags &amp; sentiment…</div>}
        {preview && !previewLoading && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-white" style={{ background: sentimentColor(preview.sentiment) }}>
              {preview.sentiment}
            </span>
            <TagPills tags={preview.tags} linkToTagsView={false} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          <button
            onClick={() => setView("list")}
            className="text-sm font-medium px-3 py-1.5 rounded-md"
            style={{ background: view === "list" ? "var(--series-1)" : "var(--surface-1)", color: view === "list" ? "white" : "var(--foreground)", border: "1px solid var(--border)" }}
          >
            List
          </button>
          <button
            onClick={() => setView("timeline")}
            className="text-sm font-medium px-3 py-1.5 rounded-md"
            style={{ background: view === "timeline" ? "var(--series-1)" : "var(--surface-1)", color: view === "timeline" ? "white" : "var(--foreground)", border: "1px solid var(--border)" }}
          >
            Timeline
          </button>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Filter by tag"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="text-sm rounded-md border px-2 py-1 bg-transparent w-36"
            style={{ borderColor: "var(--border)" }}
          />
          <input
            placeholder="Keyword search"
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            className="text-sm rounded-md border px-2 py-1 bg-transparent w-48"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
      </div>

      {view === "list" ? (
        <div className="flex flex-col gap-3">
          {filtered.map((t) => (
            <ThoughtCard key={t.id} thought={t} holdings={holdings} highlighted={String(t.id) === highlightId} onLinkHolding={linkHolding} />
          ))}
          {filtered.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No thoughts logged yet.</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {byQuarter.map(([q, list]) => (
            <div key={q}>
              <div className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                {q}
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 relative">
                <div className="absolute left-0 right-0 top-3 h-px" style={{ background: "var(--gridline)" }} />
                {list.map((t) => (
                  <div key={t.id} className="flex flex-col items-center gap-2 shrink-0 w-56 relative">
                    <span className="w-3 h-3 rounded-full z-10" style={{ background: sentimentColor(t.sentiment) }} />
                    <div className="card p-2 text-xs w-full">
                      <div style={{ color: "var(--text-muted)" }}>{new Date(t.date).toLocaleDateString()}</div>
                      <div className="line-clamp-3 mt-1">{t.text}</div>
                      {t.relatedTickers && t.relatedTickers.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.relatedTickers.map((rt) => (
                            <span key={rt.ticker} className="px-1.5 py-0.5 rounded-full" style={{ background: "var(--gridline)" }}>
                              {rt.ticker} {fmtTickerPrice(rt)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {byQuarter.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No thoughts logged yet.</div>}
        </div>
      )}
    </div>
  );
}

type PriceState = number | "loading" | "error" | undefined;

/** Shows the "at thought" price, and turns into a click-to-refresh current-price + delta
    once fetched — on demand only, never persisted, so it can't go stale between loads. */
function PriceDelta({ ticker, currency, atThought }: { ticker: string; currency?: string; atThought: number }) {
  const [current, setCurrent] = useState<PriceState>(undefined);

  async function refresh() {
    setCurrent("loading");
    try {
      const params = new URLSearchParams({ ticker, ...(currency ? { currency } : {}) });
      const res = await fetch(`/api/thoughts/price?${params}`);
      const data = await res.json();
      setCurrent(res.ok ? data.price : "error");
    } catch {
      setCurrent("error");
    }
  }

  if (current === undefined) {
    return (
      <button onClick={refresh} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
        check now
      </button>
    );
  }
  if (current === "loading") return <span className="text-xs" style={{ color: "var(--text-muted)" }}>checking…</span>;
  if (current === "error") {
    return (
      <button onClick={refresh} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
        retry
      </button>
    );
  }
  const delta = (current - atThought) / atThought;
  const color = delta > 0 ? "var(--sentiment-bullish)" : delta < 0 ? "var(--sentiment-bearish)" : "var(--text-muted)";
  return (
    <button onClick={refresh} className="text-xs font-medium hover:opacity-70" style={{ color }} title="Click to refresh">
      {fmtTickerPrice({ ticker, price: current, currency })} ({delta >= 0 ? "+" : ""}
      {(delta * 100).toFixed(1)}%)
    </button>
  );
}

function ThoughtCard({
  thought,
  holdings,
  highlighted,
  onLinkHolding,
}: {
  thought: Thought;
  holdings: Holding[];
  highlighted: boolean;
  onLinkHolding: (thoughtId: number, holdingId: number) => void;
}) {
  const tickers = thought.relatedTickers ?? [];
  const isMulti = tickers.length > 1;
  const [expanded, setExpanded] = useState(false);
  const { headline, commentary } = splitThoughtText(thought.text);

  return (
    <div
      id={`thought-${thought.id}`}
      className="card p-4"
      style={{ outline: highlighted ? "2px solid var(--series-1)" : undefined }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <SentimentDot sentiment={thought.sentiment} />
          {tickers.map((rt) => (
            <span key={rt.ticker} className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--gridline)", fontFamily: "var(--font-mono, monospace)" }}>
              {rt.ticker}
            </span>
          ))}
        </div>

        {tickers.length > 0 && (
          <div className="text-right shrink-0">
            {!isMulti ? (
              <>
                <div className="text-sm font-semibold">
                  {fmtTickerPrice(tickers[0])} <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>at thought</span>
                </div>
                <div className="mt-0.5">
                  <PriceDelta ticker={tickers[0].ticker} currency={tickers[0].currency} atThought={tickers[0].price} />
                </div>
              </>
            ) : (
              <>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {tickers.map((rt) => fmtTickerPrice(rt)).join(" · ")}
                </div>
                <button onClick={() => setExpanded((e) => !e)} className="text-xs underline mt-0.5" style={{ color: "var(--series-1)" }}>
                  {expanded ? "hide current prices" : "compare current prices"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isMulti && expanded && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md p-2.5" style={{ background: "var(--gridline)" }}>
          {tickers.map((rt) => (
            <div key={rt.ticker} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold" style={{ fontFamily: "var(--font-mono, monospace)" }}>{rt.ticker}</span>
              <span style={{ color: "var(--text-muted)" }}>{fmtTickerPrice(rt)} at thought</span>
              <PriceDelta ticker={rt.ticker} currency={rt.currency} atThought={rt.price} />
            </div>
          ))}
        </div>
      )}

      <p className="text-base font-semibold mt-3 leading-snug">{headline}</p>
      {commentary && (
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          {commentary}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <TagPills tags={thought.tags} />
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
          {new Date(thought.date).toLocaleDateString()}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <LineageThread type="thought" id={thought.id} />
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onLinkHolding(thought.id, Number(e.target.value));
            e.target.value = "";
          }}
          className="text-xs rounded-md border px-1.5 py-1 bg-transparent"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="">Link to holding…</option>
          {holdings.map((h) => (
            <option key={h.id} value={h.id}>
              {h.ticker}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function ThoughtsPage() {
  return (
    <Suspense fallback={<div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>}>
      <ThoughtsPageInner />
    </Suspense>
  );
}
