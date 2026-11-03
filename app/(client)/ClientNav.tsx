"use client";

import { usePathname } from "next/navigation";
import { MobileNav, NavFooter, NavLinks, type MobileNavLink } from "@/components/ui/MobileNav";

// Brief v4.0 (Nov 2026): four destinations first, then the daily practice
// and journal, then everything else under "More".
const DESTINATIONS: MobileNavLink[] = [
  { group: "You", href: "/", label: "My Space", icon: "home", match: (p) => p === "/" },
  { group: "You", href: "/audit", label: "Protocol", icon: "target", match: (p) => p.startsWith("/audit") },
  { group: "You", href: "/plan", label: "My Plan", icon: "map", match: (p) => p.startsWith("/plan") },
  { group: "You", href: "/journey", label: "My Journey", icon: "journey", match: (p) => p.startsWith("/journey") },
];
const MORE_LINKS: MobileNavLink[] = [
  { group: "More", href: "/learn", label: "Academy", icon: "book", match: (p) => p.startsWith("/learn") },
  { group: "More", href: "/musings", label: "Musings", icon: "quote", match: (p) => p.startsWith("/musings") },
  { group: "More", href: "/podcast", label: "Podcast", icon: "mic", match: (p) => p.startsWith("/podcast") },
  { group: "More", href: "/tools", label: "Tools", icon: "bulb", match: (p) => p.startsWith("/tools") },
  { group: "More", href: "/coaching", label: "Coaching", icon: "chat", match: (p) => p.startsWith("/coaching") },
  { group: "More", href: "/membership", label: "Membership", icon: "star", match: (p) => p.startsWith("/membership") },
];

// The phone tab bar: the four destinations (More opens the drawer with the rest).
const TABS: MobileNavLink[] = DESTINATIONS;

// Coaches and admins can use the member pages too, with a way back to the console.
const STAFF_LINK: MobileNavLink = { group: "Staff", href: "/coach", label: "Coach console", icon: "console", match: () => false };
// The daily practice (intention, reflection, journal) is for Practice and
// Momentum members and staff (lib/alignment.ts); everyone else sees it with a
// lock, and the page offers the way to join.
const practiceLinks = (locked: boolean): MobileNavLink[] => [
  { group: "Practice", href: "/alignment", label: "Daily practice", icon: "sunrise", match: (p) => p.startsWith("/alignment"), locked },
  { group: "Practice", href: "/journal", label: "Journal", icon: "pen", match: (p) => p.startsWith("/journal"), locked },
];
const linksFor = (staff: boolean, practice: boolean) => [
  ...DESTINATIONS,
  ...practiceLinks(!(practice || staff)),
  ...MORE_LINKS,
  ...(staff ? [STAFF_LINK] : []),
];

export function ClientNav({ fullName, staff = false, practice = false }: { fullName: string | null; staff?: boolean; practice?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="sb-nav">
      <NavLinks links={linksFor(staff, practice)} pathname={pathname} />
      <div className="sb-q">
        <div className="sb-qm">&ldquo;</div>
        <div className="sb-qt">Alignment is the foundation. Action is the transformation.</div>
      </div>
      <NavFooter fullName={fullName} sub="Your details" href="/details" />
    </nav>
  );
}

export function ClientMobileNav({ fullName, staff = false, practice = false }: { fullName: string | null; staff?: boolean; practice?: boolean }) {
  return <MobileNav links={linksFor(staff, practice)} fullName={fullName} sub="Your details" userHref="/details" tabs={TABS} />;
}
