"use client";

import { usePathname } from "next/navigation";
import { MobileNav, NavFooter, NavLinks, type MobileNavLink } from "@/components/ui/MobileNav";

// Brief v4.0 (Nov 2026): the destinations, then everything else under
// "More". The daily practice is part of My Space, so it lights up My Space.
// My Journey is out of the menu for now and 1,000 Months is under More
// (Duane, 10 Nov 2026).
const inMySpace = (p: string) => p === "/" || p.startsWith("/alignment");
const DESTINATIONS: MobileNavLink[] = [
  { group: "You", href: "/", label: "My Space", icon: "home", match: inMySpace },
  { group: "You", href: "/audit", label: "The Aligned Protocol", icon: "target", match: (p) => p.startsWith("/audit") },
  { group: "You", href: "/next-step", label: "The Next Step", icon: "map", match: (p) => p.startsWith("/next-step") || p.startsWith("/plan") },
];
// The journal has its own place under You (Duane, 10 Nov 2026). It's part of
// Aligned Clarity (free since 11 Nov 2026); the lock follows canUseJournal.
const JOURNAL: MobileNavLink = { group: "You", href: "/journal", label: "Journal", icon: "pen", match: (p) => p.startsWith("/journal") };
const MORE_LINKS: MobileNavLink[] = [
  { group: "More", href: "/learn", label: "Academy", icon: "book", match: (p) => p.startsWith("/learn") },
  { group: "More", href: "/musings", label: "Musings", icon: "quote", match: (p) => p.startsWith("/musings") },
  { group: "More", href: "/podcast", label: "Podcast", icon: "mic", match: (p) => p.startsWith("/podcast") },
  { group: "More", href: "/tools", label: "Tools", icon: "bulb", match: (p) => p.startsWith("/tools") },
  { group: "More", href: "/journey/months", label: "1,000 Months", icon: "journey", match: (p) => p.startsWith("/journey") },
  { group: "More", href: "/membership", label: "Membership", icon: "star", match: (p) => p.startsWith("/membership") },
];

// Members with a coach see Coaching second, after My Space (Duane, 10 Nov
// 2026: My Space is the window onto the rest); everyone else finds it under
// More.
const COACHING: MobileNavLink = { group: "You", href: "/coaching", label: "Coaching", icon: "chat", match: (p) => p.startsWith("/coaching") };
const MORE_COACHING: MobileNavLink = { ...COACHING, group: "More" };

// The phone tab bar: the destinations, with shorter labels for the Protocol
// and The Next Step so all five tabs fit (More opens the drawer with the
// rest). The fourth tab is Coaching for members with a coach, else the
// journal.
const SHORT: Record<string, string> = { "/audit": "Protocol", "/next-step": "Next Step" };
const TABS: MobileNavLink[] = DESTINATIONS.map((d) => (SHORT[d.href] ? { ...d, label: SHORT[d.href] } : d));
const tabsFor = (coached: boolean, journalLocked: boolean): MobileNavLink[] => [...TABS, coached ? COACHING : { ...JOURNAL, locked: journalLocked }];

// Coaches and admins can use the member pages too, with a way back to the console.
const STAFF_LINK: MobileNavLink = { group: "Staff", href: "/coach", label: "Coach console", icon: "console", match: () => false };
// `hide`: sections with nothing in them yet on the live site (Academy,
// Musings, Podcast until Duane approves their content; lib/learn-content.ts).
const linksFor = (staff: boolean, coached: boolean, journalLocked: boolean, hide: string[] = []) => [
  DESTINATIONS[0],
  ...(coached ? [COACHING] : []),
  ...DESTINATIONS.slice(1),
  { ...JOURNAL, locked: journalLocked },
  ...MORE_LINKS.slice(0, 5),
  ...(coached ? [] : [MORE_COACHING]),
  ...MORE_LINKS.slice(5),
  ...(staff ? [STAFF_LINK] : []),
].filter((l) => !hide.includes(l.href));

export function ClientNav({ fullName, staff = false, coached = false, journalLocked = false, hide = [] }: { fullName: string | null; staff?: boolean; coached?: boolean; journalLocked?: boolean; hide?: string[] }) {
  const pathname = usePathname();

  return (
    <nav className="sb-nav">
      <NavLinks links={linksFor(staff, coached, journalLocked, hide)} pathname={pathname} />
      <div className="sb-q">
        <div className="sb-qm">&ldquo;</div>
        <div className="sb-qt">Alignment is the foundation. Action is the transformation.</div>
      </div>
      <NavFooter fullName={fullName} sub="Your details" href="/details" />
    </nav>
  );
}

export function ClientMobileNav({ fullName, staff = false, coached = false, journalLocked = false, hide = [] }: { fullName: string | null; staff?: boolean; coached?: boolean; journalLocked?: boolean; hide?: string[] }) {
  return <MobileNav links={linksFor(staff, coached, journalLocked, hide)} fullName={fullName} sub="Your details" userHref="/details" tabs={tabsFor(coached, journalLocked)} />;
}
