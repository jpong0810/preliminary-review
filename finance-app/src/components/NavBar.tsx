"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/investments", label: "Investments" },
  { href: "/thoughts", label: "Thoughts" },
  { href: "/research", label: "Research" },
  { href: "/digest", label: "Digest" },
  { href: "/tags", label: "Tags" },
  { href: "/lineage", label: "Lineage" },
  { href: "/todos", label: "To-do" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
      <nav className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
        <span className="font-bold text-sm py-4 pr-4 whitespace-nowrap" style={{ color: "var(--foreground)" }}>
          Finance &amp; Research
        </span>
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "px-3 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                active ? "border-current" : "border-transparent opacity-60 hover:opacity-100"
              )}
              style={{ color: active ? "var(--series-1)" : "var(--foreground)" }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
