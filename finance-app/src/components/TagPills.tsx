import Link from "next/link";

export function TagPills({ tags, linkToTagsView = true }: { tags: string[]; linkToTagsView?: boolean }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) =>
        linkToTagsView ? (
          <Link
            key={t}
            href={`/tags/${encodeURIComponent(t)}`}
            className="text-xs px-2 py-0.5 rounded-full hover:opacity-80"
            style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}
          >
            {t}
          </Link>
        ) : (
          <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}>
            {t}
          </span>
        )
      )}
    </div>
  );
}
