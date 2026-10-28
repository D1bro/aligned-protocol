"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { BrandMark } from "@/components/ui/BrandMark";
import { Icon, type IconName } from "@/components/ui/Icon";

export type MobileNavLink = { href: string; label: string; icon: IconName; match: (p: string) => boolean; group?: string; locked?: boolean };

// The menu links, with a small heading wherever the group changes.
export function NavLinks({ links, pathname, onNavigate }: { links: MobileNavLink[]; pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {links.map((l, i) => (
        <div key={l.href}>
          {l.group && l.group !== links[i - 1]?.group ? <div className="ni-group">{l.group}</div> : null}
          <Link href={l.href} className={`ni ${l.match(pathname) ? "active" : ""}`} onClick={onNavigate}>
            <Icon name={l.icon} />
            {l.label}
            {l.locked ? (
              <span className="ni-lock" title="Part of Aligned Practice">
                <svg width="11" height="11" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                <span className="sr-only">(Aligned Practice)</span>
              </span>
            ) : null}
          </Link>
        </div>
      ))}
    </>
  );
}

const initial = (name: string | null) => name?.trim().charAt(0).toUpperCase() || "A";

// Who is signed in, at the foot of the menu, with sign out beside it.
// `href` makes the name a link (members: to Your details).
export function NavFooter({ fullName, sub, href, onNavigate }: { fullName: string | null; sub: string; href?: string; onNavigate?: () => void }) {
  const who = (
    <>
      <span className="avatar" aria-hidden="true">{initial(fullName)}</span>
      <span className="nav-user-text">
        <b>{fullName ?? "Signed in"}</b>
        <span>{sub}</span>
      </span>
    </>
  );
  return (
    <div className="nav-user">
      {href ? (
        <Link href={href} className="nav-user-who" onClick={onNavigate}>{who}</Link>
      ) : (
        <div className="nav-user-who">{who}</div>
      )}
      <form action={signOut}>
        <button type="submit" className="nav-signout" aria-label="Sign out" title="Sign out">
          <Icon name="signout" size={17} />
        </button>
      </form>
    </div>
  );
}

// The sidebar (.sidebar) is hidden entirely under 768px — this is what
// replaces it there: a slim top bar, and a drawer holding the exact same
// links as the desktop sidebar, opened by the menu button. With `tabs`, phones
// also get a bottom tab bar for the main pages (its "More" opens the same
// drawer) and a profile button beside the menu button.
export function MobileNav({
  links,
  fullName,
  sub,
  userHref,
  tabs,
}: {
  links: MobileNavLink[];
  fullName: string | null;
  sub: string;
  userHref?: string;
  tabs?: MobileNavLink[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const inTabs = tabs?.some((t) => t.match(pathname)) ?? false;

  return (
    <>
      <div className="mob-bar">
        <Link href={tabs ? "/" : links[0].href} className="mob-brand" aria-label="Aligned, home">
          <BrandMark width={22} />
          <span className="mob-brand-text">ALIGNED</span>
        </Link>
        <div className="mob-bar-end">
          {tabs && userHref ? (
            <Link href={userHref} className="avatar mob-avatar" aria-label="Your details">{initial(fullName)}</Link>
          ) : null}
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
      </div>

      {tabs ? (
        <nav className="tabbar" aria-label="Main">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={t.match(pathname) ? "tab on" : "tab"} aria-current={t.match(pathname) ? "page" : undefined}>
              <Icon name={t.icon} size={21} />
              {t.label}
            </Link>
          ))}
          <button type="button" className={!inTabs || open ? "tab on" : "tab"} onClick={() => setOpen(true)} aria-expanded={open}>
            <Icon name="more" size={21} />
            More
          </button>
        </nav>
      ) : null}

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
            <NavFooter fullName={fullName} sub={sub} href={userHref} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      )}
    </>
  );
}
