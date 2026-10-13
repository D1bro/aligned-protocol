"use client";

import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { NavLinks, type MobileNavLink } from "@/components/ui/MobileNav";

export const CLIENT_LINKS: MobileNavLink[] = [
  { group: "You", href: "/", label: "My profile", icon: "▦", match: (p) => p === "/" },
  { group: "You", href: "/audit", label: "The Aligned Audit", icon: "◎", match: (p) => p.startsWith("/audit") },
  { group: "You", href: "/clear", label: "My plan", icon: "◈", match: (p) => p.startsWith("/clear") || p.startsWith("/goals") },
  { group: "You", href: "/summary", label: "My journey", icon: "◑", match: (p) => p.startsWith("/summary") },
  { group: "Learn", href: "/learn", label: "Academy", icon: "◇", match: (p) => p.startsWith("/learn") },
  { group: "Learn", href: "/musings", label: "Musings", icon: "❝", match: (p) => p.startsWith("/musings") },
  { group: "Learn", href: "/podcast", label: "Podcast", icon: "◐", match: (p) => p.startsWith("/podcast") },
  { group: "Learn", href: "/tools", label: "Tools", icon: "✎", match: (p) => p.startsWith("/tools") },
  { group: "Grow", href: "/coaching", label: "Coaching", icon: "◉", match: (p) => p.startsWith("/coaching") },
];

export function ClientNav({ fullName }: { fullName: string | null }) {
  const pathname = usePathname();

  return (
    <nav className="sb-nav">
      <NavLinks links={CLIENT_LINKS} pathname={pathname} />
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
