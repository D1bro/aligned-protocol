import Link from "next/link";

// Between the two parts of the daily practice.
export function PracticeNav({ on }: { on: "daily" | "journal" }) {
  return (
    <nav className="practice-nav" aria-label="Daily practice">
      <Link href="/alignment" aria-current={on === "daily" ? "page" : undefined}>Daily intention and reflection</Link>
      <Link href="/alignment/journal" aria-current={on === "journal" ? "page" : undefined}>Journal</Link>
    </nav>
  );
}
