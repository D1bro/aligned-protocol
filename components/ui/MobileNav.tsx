"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { BrandMark } from "@/components/ui/BrandMark";

export type MobileNavLink = { href: string; label: string; icon: string; match: (p: string) => boolean; group?: string };

// The menu links, with a small heading wherever the group changes.
export function NavLinks({ links, pathname, onNavigate }: { links: MobileNavLink[]; pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {links.map((l, i) => (
        <div key={l.href}>
          {l.group && l.group !== links[i - 1]?.group ? <div className="ni-group">{l.group}</div> : null}
          <Link href={l.href} className={`ni ${l.match(pathname) ? "active" : ""}`} onClick={onNavigate}>
            <span aria-hidden="true">{l.icon}</span>
            {l.label}
          </Link>
        </div>
      ))}
    </>
  );
}

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
          <BrandMark width={22} />
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
            <NavLinks links={links} pathname={pathname} onNavigate={() => setOpen(false)} />
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
