import Link from "next/link";

export type CoachingTab = "coaching" | "payments";

// The Coaching page's two tabs: the coaching itself, and sessions and
// payments (packages, invoices). Links, so a tab can be linked to directly
// (Top up, returning from a card payment).
export function CoachingTabs({ base, active, coached }: { base: string; active: CoachingTab; coached: boolean }) {
  const tabs: [CoachingTab, string, string][] = [
    ["coaching", coached ? "Your coaching" : "Coaching", base],
    ["payments", "Sessions and payments", `${base}?tab=payments`],
  ];
  return (
    <nav className="alignment-tabs mc-tabs" aria-label="Coaching">
      {tabs.map(([key, label, href]) => (
        <Link key={key} href={href} aria-current={active === key ? "page" : undefined} scroll={false}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

// ?tab=payments, or returning from a card payment, opens Sessions and payments.
export function coachingTab(sp: { tab?: string; paid?: string }): CoachingTab {
  return sp.tab === "payments" || sp.paid === "1" ? "payments" : "coaching";
}
