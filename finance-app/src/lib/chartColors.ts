// Fixed categorical order — never cycled/reassigned per filter — per the dataviz palette.
export const CATEGORICAL = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

// Chart.js can't read CSS vars directly in canvas — resolve them at render time.
export function resolveColor(cssVar: string): string {
  if (typeof window === "undefined") return "#2a78d6";
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar.replace("var(", "").replace(")", "")).trim() || "#2a78d6";
}

export function categoricalColors(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(resolveColor(CATEGORICAL[i % CATEGORICAL.length]));
  return out;
}

export const SENTIMENT_COLOR: Record<string, string> = {
  bullish: "var(--sentiment-bullish)",
  bearish: "var(--sentiment-bearish)",
  neutral: "var(--sentiment-neutral)",
};
