"use client";

import { usePathname } from "next/navigation";
import { MobileNav, NavFooter, NavLinks, type MobileNavLink } from "@/components/ui/MobileNav";

type StaffRole = "coach" | "admin";

// The console's menu. Overview, Billing, Site health and Settings are for admins; coaches see
// their own clients and coaching enquiries.
const LINKS: (MobileNavLink & { adminOnly?: boolean })[] = [
  { group: "Console", href: "/coach", label: "Overview", icon: "pulse", match: (p) => p === "/coach", adminOnly: true },
  { group: "Console", href: "/coach/clients", label: "Clients", icon: "users", match: (p) => p.startsWith("/coach/clients") },
  { group: "Console", href: "/coach/enquiries", label: "Enquiries", icon: "inbox", match: (p) => p.startsWith("/coach/enquiries") },
  { group: "Console", href: "/coach/billing", label: "Billing", icon: "receipt", match: (p) => p.startsWith("/coach/billing"), adminOnly: true },
  { group: "Console", href: "/coach/health", label: "Site health", icon: "console", match: (p) => p.startsWith("/coach/health"), adminOnly: true },
  { group: "Console", href: "/coach/settings", label: "Settings", icon: "settings", match: (p) => p.startsWith("/coach/settings"), adminOnly: true },
  { group: "You", href: "/", label: "My member area", icon: "home", match: () => false },
];

const linksFor = (role: StaffRole) => LINKS.filter((l) => role === "admin" || !l.adminOnly);

export function CoachNav({ fullName, role }: { fullName: string | null; role: StaffRole }) {
  const pathname = usePathname();

  return (
    <nav className="sb-nav">
      <NavLinks links={linksFor(role)} pathname={pathname} />
      <div className="sb-q">
        <div className="sb-qm">&ldquo;</div>
        <div className="sb-qt">Alignment is the foundation. Action is the transformation.</div>
      </div>
      <NavFooter fullName={fullName} sub={role === "admin" ? "Admin" : "Coach"} />
    </nav>
  );
}

export function CoachMobileNav({ fullName, role }: { fullName: string | null; role: StaffRole }) {
  return <MobileNav links={linksFor(role)} fullName={fullName} sub={role === "admin" ? "Admin" : "Coach"} />;
}
