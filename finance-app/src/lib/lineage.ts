import { prisma } from "./db";

export type LineageNodeType = "digest_source" | "insight" | "thought" | "research" | "holding" | "call";

export type LineageNode = {
  type: LineageNodeType;
  id: number;
  date: Date;
  label: string;
};

type Key = `${LineageNodeType}:${number}`;
const key = (type: LineageNodeType, id: number): Key => `${type}:${id}`;

/**
 * Walks the existing cross-entity links (Insight<->Thought, Thought<->Research,
 * Thought<->Holding, DigestSource<->Insight/Call) breadth-first from a starting node
 * and returns every reachable node, in date order. This is intentionally a thin,
 * additive view over links that already exist elsewhere — no new schema.
 */
export async function getLineage(startType: LineageNodeType, startId: number, maxDepth = 8): Promise<LineageNode[]> {
  const visited = new Set<Key>();
  const nodes = new Map<Key, LineageNode>();
  let frontier: { type: LineageNodeType; id: number }[] = [{ type: startType, id: startId }];
  let depth = 0;

  while (frontier.length && depth < maxDepth) {
    const nextFrontier: { type: LineageNodeType; id: number }[] = [];

    for (const { type, id } of frontier) {
      const k = key(type, id);
      if (visited.has(k)) continue;
      visited.add(k);

      const neighbors = await loadNodeAndNeighbors(type, id);
      if (!neighbors) continue;
      nodes.set(k, neighbors.self);
      for (const n of neighbors.neighbors) {
        if (!visited.has(key(n.type, n.id))) nextFrontier.push(n);
      }
    }

    frontier = nextFrontier;
    depth++;
  }

  return Array.from(nodes.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function loadNodeAndNeighbors(
  type: LineageNodeType,
  id: number
): Promise<{ self: LineageNode; neighbors: { type: LineageNodeType; id: number }[] } | null> {
  const neighbors: { type: LineageNodeType; id: number }[] = [];

  if (type === "digest_source") {
    const s = await prisma.digestSource.findUnique({ where: { id } });
    if (!s) return null;
    const insights = await prisma.insight.findMany({ where: { sourceId: id }, select: { id: true } });
    const calls = await prisma.call.findMany({ where: { digestSourceId: id }, select: { id: true } });
    insights.forEach((i) => neighbors.push({ type: "insight", id: i.id }));
    calls.forEach((c) => neighbors.push({ type: "call", id: c.id }));
    return { self: { type, id, date: s.date, label: `Read "${s.title}"${s.speaker ? ` (${s.speaker})` : ""}` }, neighbors };
  }

  if (type === "insight") {
    const i = await prisma.insight.findUnique({ where: { id } });
    if (!i) return null;
    if (i.sourceId) neighbors.push({ type: "digest_source", id: i.sourceId });
    if (i.linkedThoughtId) neighbors.push({ type: "thought", id: i.linkedThoughtId });
    return { self: { type, id, date: i.dateSaved, label: `Saved insight: "${truncate(i.text)}"` }, neighbors };
  }

  if (type === "thought") {
    const t = await prisma.thought.findUnique({ where: { id } });
    if (!t) return null;
    const promotedFrom = await prisma.insight.findMany({ where: { linkedThoughtId: id }, select: { id: true } });
    const seededResearch = await prisma.research.findMany({ where: { linkedThoughtId: id }, select: { id: true } });
    const calls = await prisma.call.findMany({ where: { thoughtId: id }, select: { id: true } });
    promotedFrom.forEach((i) => neighbors.push({ type: "insight", id: i.id }));
    if (t.linkedResearchId) neighbors.push({ type: "research", id: t.linkedResearchId });
    seededResearch.forEach((r) => neighbors.push({ type: "research", id: r.id }));
    t.relatedHoldingIds.forEach((hid) => neighbors.push({ type: "holding", id: hid }));
    calls.forEach((c) => neighbors.push({ type: "call", id: c.id }));
    return { self: { type, id, date: t.date, label: `Logged thought: "${truncate(t.text)}"` }, neighbors };
  }

  if (type === "research") {
    const r = await prisma.research.findUnique({ where: { id } });
    if (!r) return null;
    if (r.linkedThoughtId) neighbors.push({ type: "thought", id: r.linkedThoughtId });
    const spawned = await prisma.thought.findMany({ where: { linkedResearchId: id }, select: { id: true } });
    spawned.forEach((t) => neighbors.push({ type: "thought", id: t.id }));
    return { self: { type, id, date: r.date, label: `Researched "${r.topic}"` }, neighbors };
  }

  if (type === "holding") {
    const h = await prisma.holding.findUnique({ where: { id } });
    if (!h) return null;
    const thoughts = await prisma.thought.findMany({ where: { relatedHoldingIds: { has: id } }, select: { id: true } });
    thoughts.forEach((t) => neighbors.push({ type: "thought", id: t.id }));
    return { self: { type, id, date: h.updatedAt, label: `Added ${h.ticker} position` }, neighbors };
  }

  if (type === "call") {
    const c = await prisma.call.findUnique({ where: { id } });
    if (!c) return null;
    if (c.digestSourceId) neighbors.push({ type: "digest_source", id: c.digestSourceId });
    if (c.thoughtId) neighbors.push({ type: "thought", id: c.thoughtId });
    return { self: { type, id, date: c.dateMade, label: `Call logged: ${c.subject} — ${c.description}` }, neighbors };
  }

  return null;
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
