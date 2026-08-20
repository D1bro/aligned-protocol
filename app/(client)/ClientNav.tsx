"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

export const CLIENT_LINKS = [
  { href: "/", label: "Dashboard", icon: "▦", match: (p: string) => p === "/" },
  { href: "/audit", label: "The Aligned Audit", icon: "◎", match: (p: string) => p.startsWith("/audit") },
  { href: "/clear", label: "CLEAR Process", icon: "◈", match: (p: string) => p.startsWith("/clear") },
  { href: "/goals", label: "My Goals", icon: "★", match: (p: string) => p.startsWith("/goals") },
  { href: "/summary", label: "My Summary", icon: "◑", match: (p: string) => p.startsWith("/summary") },
];

export function ClientNav({ fullName }: { fullName: string | null }) {
  const pathname = usePathname();

  return (
    <nav className="sb-nav">
      {CLIENT_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={`ni ${l.match(pathname) ? "active" : ""}`}>
          <span aria-hidden="true">{l.icon}</span>
          {l.label}
        </Link>
      ))}
      <div className="sb-q">
        <div className="sb-qm">&ldquo;</div>
        <div className="sb-qt">Alignment is the foundation. Action is the transformation.</div>
      </div>
      <form action={signOut} style={{ padding: "0 1.5rem" }}>
        <button type="submit" className="ni" style={{ width: "100%", justifyContent: "flex-start" }}>
          <span aria-hidden="true">⏻</span> Sign out
        </button>
      </form>
      {fullName ? (
        <div style={{ padding: ".75rem 1.5rem 1.25rem", fontSize: "11px", color: "var(--text3)" }}>
          Signed in as {fullName}
        </div>
      ) : null}
    </nav>
  );
}
