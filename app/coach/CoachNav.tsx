"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { MobileNav, type MobileNavLink } from "@/components/ui/MobileNav";

const COACH_LINKS: MobileNavLink[] = [
  { href: "/coach", label: "Client Roster", icon: "▦", match: (p) => p === "/coach" || p.startsWith("/coach/clients") },
  { href: "/", label: "My member area", icon: "◎", match: () => false },
];

// Defined here (a browser component) because functions can't be passed from
// the server layout to a browser component.
export function CoachMobileNav({ fullName }: { fullName: string | null }) {
  return <MobileNav links={COACH_LINKS} fullName={fullName} />;
}

export function CoachNav({ fullName }: { fullName: string | null }) {
  const pathname = usePathname();
  const active = pathname === "/coach" || pathname.startsWith("/coach/clients");

  return (
    <nav className="sb-nav">
      <Link href="/coach" className={`ni ${active ? "active" : ""}`}>
        <span aria-hidden="true">▦</span> Client Roster
      </Link>
      <Link href="/" className="ni">
        <span aria-hidden="true">◎</span> My member area
      </Link>
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
