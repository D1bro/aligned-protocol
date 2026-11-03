"use client";

import { usePathname } from "next/navigation";
import { MobileNav, NavFooter, NavLinks, type MobileNavLink } from "@/components/ui/MobileNav";

// Brief v4.0 (Nov 2026): four destinations, then everything else under
// "More". The daily practice and journal are part of My Space (its daily card
// links to both, and My Journey links to the journal), so they light up My
// Space rather than having menu items of their own.
const inMySpace = (p: string) => p === "/" || p.startsWith("/alignment") || p.startsWith("/journal");
const DESTINATIONS: MobileNavLink[] = [
  { group: "You", href: "/", label: "My Space", icon: "home", match: inMySpace },
  { group: "You", href: "/audit", label: "The Aligned Protocol", icon: "target", match: (p) => p.startsWith("/audit") },
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

// The phone tab bar: the four destinations, with a shorter label for the
// Protocol so all five tabs fit (More opens the drawer with the rest).
const TABS: MobileNavLink[] = DESTINATIONS.map((d) => (d.href === "/audit" ? { ...d, label: "Protocol" } : d));

// Coaches and admins can use the member pages too, with a way back to the console.
const STAFF_LINK: MobileNavLink = { group: "Staff", href: "/coach", label: "Coach console", icon: "console", match: () => false };
const linksFor = (staff: boolean) => [...DESTINATIONS, ...MORE_LINKS, ...(staff ? [STAFF_LINK] : [])];

export function ClientNav({ fullName, staff = false }: { fullName: string | null; staff?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="sb-nav">
      <NavLinks links={linksFor(staff)} pathname={pathname} />
      <div className="sb-q">
        <div className="sb-qm">&ldquo;</div>
        <div className="sb-qt">Alignment is the foundation. Action is the transformation.</div>
      </div>
      <NavFooter fullName={fullName} sub="Your details" href="/details" />
    </nav>
  );
}

export function ClientMobileNav({ fullName, staff = false }: { fullName: string | null; staff?: boolean }) {
  return <MobileNav links={linksFor(staff)} fullName={fullName} sub="Your details" userHref="/details" tabs={TABS} />;
}
