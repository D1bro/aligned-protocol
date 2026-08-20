"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

export function CoachNav({ fullName }: { fullName: string | null }) {
  const pathname = usePathname();
  const active = pathname === "/coach" || pathname.startsWith("/coach/clients");

  return (
    <nav className="sb-nav">
      <Link href="/coach" className={`ni ${active ? "active" : ""}`}>
        <span aria-hidden="true">▦</span> Client Roster
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
