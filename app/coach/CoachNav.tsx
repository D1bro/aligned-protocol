"use client";

import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { MobileNav, NavLinks, type MobileNavLink } from "@/components/ui/MobileNav";

type StaffRole = "coach" | "admin";

// The console's menu. Overview and Site health are for admins; coaches see
// their own clients and coaching enquiries.
const LINKS: (MobileNavLink & { adminOnly?: boolean })[] = [
  { group: "Console", href: "/coach", label: "Overview", icon: "◎", match: (p) => p === "/coach", adminOnly: true },
  { group: "Console", href: "/coach/clients", label: "Clients", icon: "▦", match: (p) => p.startsWith("/coach/clients") },
  { group: "Console", href: "/coach/enquiries", label: "Enquiries", icon: "✉", match: (p) => p.startsWith("/coach/enquiries") },
  { group: "Console", href: "/coach/health", label: "Site health", icon: "◈", match: (p) => p.startsWith("/coach/health"), adminOnly: true },
  { group: "You", href: "/", label: "My member area", icon: "◎", match: () => false },
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
      <form action={signOut} style={{ padding: "0 1.5rem" }}>
        <button type="submit" className="ni" style={{ width: "100%", justifyContent: "flex-start" }}>
          <span aria-hidden="true">⏻</span> Sign out
        </button>
      </form>
      {fullName ? (
        <div style={{ padding: ".75rem 1.5rem 1.25rem", fontSize: "11px", color: "var(--text3)" }}>
          Signed in as {fullName} · {role === "admin" ? "Admin" : "Coach"}
        </div>
      ) : null}
    </nav>
  );
}

export function CoachMobileNav({ fullName, role }: { fullName: string | null; role: StaffRole }) {
  return <MobileNav links={linksFor(role)} fullName={fullName} />;
}
