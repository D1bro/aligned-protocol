"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

export type MobileNavLink = { href: string; label: string; icon: string; match: (p: string) => boolean };

// The sidebar (.sidebar) is hidden entirely under 768px — this is what
// replaces it there: a slim top bar with a hamburger button that opens a
// slide-in drawer holding the exact same links as the desktop sidebar.
// Without this, phone-width visitors had no way to navigate the app at all.
export function MobileNav({ links, fullName }: { links: MobileNavLink[]; fullName: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mob-bar">
        <div className="mob-brand">
          <svg width="22" height="20" viewBox="0 0 30 27" fill="none" aria-hidden="true">
            <path d="M15 1 L29 25 L1 25 Z" stroke="#E0B140" strokeWidth="2.2" fill="none" />
            <circle cx="15" cy="18" r="2.5" fill="#E0B140" />
          </svg>
          <span className="mob-brand-text">ALIGNED</span>
        </div>
        <button
          type="button"
          className="mob-menu-btn"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>

      {open && (
        <div className="mob-drawer-overlay" onClick={() => setOpen(false)}>
          <nav className="mob-drawer" onClick={(e) => e.stopPropagation()} aria-label="Main navigation">
            <div className="mob-drawer-head">
              <span className="sb-brand">ALIGNED</span>
              <button type="button" className="mob-close-btn" onClick={() => setOpen(false)} aria-label="Close menu">
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`ni ${l.match(pathname) ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true">{l.icon}</span>
                {l.label}
              </Link>
            ))}
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
        </div>
      )}
    </>
  );
}
