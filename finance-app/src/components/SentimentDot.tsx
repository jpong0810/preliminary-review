const COLOR: Record<string, string> = {
  bullish: "var(--sentiment-bullish)",
  bearish: "var(--sentiment-bearish)",
  neutral: "var(--sentiment-neutral)",
};

export function sentimentColor(sentiment: string): string {
  return COLOR[sentiment] ?? COLOR.neutral;
}

export function SentimentDot({ sentiment }: { sentiment: string }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: sentimentColor(sentiment) }} title={sentiment} />;
}
