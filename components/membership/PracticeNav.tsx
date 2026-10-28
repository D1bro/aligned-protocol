import Link from "next/link";

// The daily practice's tabs where the workspace isn't open (the journal, and
// the join page): the same four places, as links.
export function PracticeNav({ on }: { on: "daily" | "journal" }) {
  return (
    <nav className="dp-tabs" aria-label="Daily practice">
      <div className="alignment-tabs">
        <Link href="/alignment" aria-current={on === "daily" ? "page" : undefined}>Today</Link>
        <Link href="/alignment?view=week">Weekly review</Link>
        <Link href="/alignment?view=privacy">Privacy &amp; history</Link>
      </div>
      <Link href="/alignment/journal" className="dp-tab-link" aria-current={on === "journal" ? "page" : undefined}>Journal</Link>
    </nav>
  );
}
