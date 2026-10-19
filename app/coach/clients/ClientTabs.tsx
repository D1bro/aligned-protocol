import Link from "next/link";
import { VIEW_LABELS, type ViewKey } from "@/lib/console-views";

export const VIEWS: ViewKey[] = ["audits", "plans", "checkins", "lessons"];

// The list switcher above the Clients pages. Guests is for admins only.
export function ClientTabs({ current, isAdmin }: { current: ViewKey | "people" | "guests"; isAdmin: boolean }) {
  return (
    <nav className="admin-tabs" aria-label="Lists">
      <Link href="/coach/clients" aria-current={current === "people" ? "page" : undefined}>People</Link>
      {VIEWS.map((v) => (
        <Link key={v} href={`/coach/clients?view=${v}`} aria-current={current === v ? "page" : undefined}>{VIEW_LABELS[v]}</Link>
      ))}
      {isAdmin ? <Link href="/coach/clients/guests" aria-current={current === "guests" ? "page" : undefined}>Guests</Link> : null}
    </nav>
  );
}
