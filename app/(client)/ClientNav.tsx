"use client";

import { usePathname } from "next/navigation";
import { MobileNav, NavFooter, NavLinks, type MobileNavLink } from "@/components/ui/MobileNav";

// Brief v4.0 (Nov 2026): four destinations, then everything else under
// "More". The daily practice and journal are part of My Space (its daily card
// links to both, and My Journey links to the journal), so they light up My
// Space rather than having menu items of their own.
const inMySpace = (p: string) => p === "/" || p.startsWith("/alignment");
const DESTINATIONS: MobileNavLink[] = [
  { group: "You", href: "/", label: "My Space", icon: "home", match: inMySpace },
  { group: "You", href: "/audit", label: "The Aligned Protocol", icon: "target", match: (p) => p.startsWith("/audit") },
  { group: "You", href: "/next-step", label: "The Next Step", icon: "map", match: (p) => p.startsWith("/next-step") || p.startsWith("/plan") },
  { group: "You", href: "/journey", label: "My Journey", icon: "journey", match: (p) => p.startsWith("/journey") },
];
// The journal has its own place under You (Duane, 10 Nov 2026). It's part of
// Aligned Practice and Momentum, so it shows a lock for everyone else.
const JOURNAL: MobileNavLink = { group: "You", href: "/journal", label: "Journal", icon: "pen", match: (p) => p.startsWith("/journal") };
const MORE_LINKS: MobileNavLink[] = [
  { group: "More", href: "/learn", label: "Academy", icon: "book", match: (p) => p.startsWith("/learn") },
  { group: "More", href: "/musings", label: "Musings", icon: "quote", match: (p) => p.startsWith("/musings") },
  { group: "More", href: "/podcast", label: "Podcast", icon: "mic", match: (p) => p.startsWith("/podcast") },
  { group: "More", href: "/tools", label: "Tools", icon: "bulb", match: (p) => p.startsWith("/tools") },
  { group: "More", href: "/membership", label: "Membership", icon: "star", match: (p) => p.startsWith("/membership") },
];

// Members with a coach see Coaching second, after My Space (Duane, 10 Nov
// 2026: My Space is the window onto the rest); everyone else finds it under
// More.
const COACHING: MobileNavLink = { group: "You", href: "/coaching", label: "Coaching", icon: "chat", match: (p) => p.startsWith("/coaching") };
const MORE_COACHING: MobileNavLink = { ...COACHING, group: "More" };

// The phone tab bar: the four destinations, with shorter labels for the
// Protocol and The Next Step so all five tabs fit (More opens the drawer with the rest).
// Members with a coach get Coaching in place of My Journey, which stays in
// the drawer (Duane, 9 Nov 2026).
const SHORT: Record<string, string> = { "/audit": "Protocol", "/next-step": "Next Step" };
const TABS: MobileNavLink[] = DESTINATIONS.map((d) => (SHORT[d.href] ? { ...d, label: SHORT[d.href] } : d));
const COACHED_TABS: MobileNavLink[] = TABS.map((t) => (t.href === "/journey" ? COACHING : t));

// Coaches and admins can use the member pages too, with a way back to the console.
const STAFF_LINK: MobileNavLink = { group: "Staff", href: "/coach", label: "Coach console", icon: "console", match: () => false };
const linksFor = (staff: boolean, coached: boolean, journalLocked: boolean) => [
  DESTINATIONS[0],
  ...(coached ? [COACHING] : []),
  ...DESTINATIONS.slice(1),
  { ...JOURNAL, locked: journalLocked },
  ...MORE_LINKS.slice(0, 4),
  ...(coached ? [] : [MORE_COACHING]),
  ...MORE_LINKS.slice(4),
  ...(staff ? [STAFF_LINK] : []),
];

export function ClientNav({ fullName, staff = false, coached = false, journalLocked = false }: { fullName: string | null; staff?: boolean; coached?: boolean; journalLocked?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="sb-nav">
      <NavLinks links={linksFor(staff, coached, journalLocked)} pathname={pathname} />
      <div className="sb-q">
        <div className="sb-qm">&ldquo;</div>
        <div className="sb-qt">Alignment is the foundation. Action is the transformation.</div>
      </div>
      <NavFooter fullName={fullName} sub="Your details" href="/details" />
    </nav>
  );
}

export function ClientMobileNav({ fullName, staff = false, coached = false, journalLocked = false }: { fullName: string | null; staff?: boolean; coached?: boolean; journalLocked?: boolean }) {
  return <MobileNav links={linksFor(staff, coached, journalLocked)} fullName={fullName} sub="Your details" userHref="/details" tabs={coached ? COACHED_TABS : TABS} />;
}
