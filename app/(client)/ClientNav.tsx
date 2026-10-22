"use client";

import { usePathname } from "next/navigation";
import { MobileNav, NavFooter, NavLinks, type MobileNavLink } from "@/components/ui/MobileNav";

export const CLIENT_LINKS: MobileNavLink[] = [
  { group: "You", href: "/", label: "My profile", icon: "home", match: (p) => p === "/" },
  { group: "You", href: "/audit", label: "The Aligned Audit", icon: "target", match: (p) => p.startsWith("/audit") },
  { group: "You", href: "/clear", label: "My plan", icon: "map", match: (p) => p.startsWith("/clear") || p.startsWith("/goals") },
  { group: "You", href: "/summary", label: "My journey", icon: "journey", match: (p) => p.startsWith("/summary") },
  { group: "Learn", href: "/learn", label: "Academy", icon: "book", match: (p) => p.startsWith("/learn") },
  { group: "Learn", href: "/musings", label: "Musings", icon: "quote", match: (p) => p.startsWith("/musings") },
  { group: "Learn", href: "/podcast", label: "Podcast", icon: "mic", match: (p) => p.startsWith("/podcast") },
  { group: "Learn", href: "/tools", label: "Tools", icon: "pen", match: (p) => p.startsWith("/tools") },
  { group: "Grow", href: "/coaching", label: "Coaching", icon: "chat", match: (p) => p.startsWith("/coaching") },
];

// The phone tab bar: the four "You" pages, with short names (More holds the rest).
const TABS: MobileNavLink[] = [
  { ...CLIENT_LINKS[0], label: "Home" },
  { ...CLIENT_LINKS[1], label: "Audit" },
  { ...CLIENT_LINKS[2], label: "Plan" },
  { ...CLIENT_LINKS[3], label: "Journey" },
];

// Coaches and admins can use the member pages too, with a way back to the console.
const STAFF_LINK: MobileNavLink = { group: "Staff", href: "/coach", label: "Coach console", icon: "console", match: () => false };
// Daily Alignment is Tier 2; until that exists only staff have it (lib/alignment.ts).
const ALIGNMENT_LINK: MobileNavLink = { group: "You", href: "/alignment", label: "Daily Alignment", icon: "sunrise", match: (p) => p.startsWith("/alignment") };
const linksFor = (staff: boolean) => (staff ? [CLIENT_LINKS[0], ALIGNMENT_LINK, ...CLIENT_LINKS.slice(1), STAFF_LINK] : CLIENT_LINKS);

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
