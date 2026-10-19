import Link from "next/link";

export function DailyAlignmentCard() {
  return (
    <section className="alignment-entry" aria-labelledby="daily-entry-heading">
      <div>
        <p className="alignment-kicker">A little space for today</p>
        <h2 id="daily-entry-heading">Daily alignment</h2>
        <p>Be present. Choose one meaningful action. Notice what helped.</p>
        <p className="alignment-small">Use the practice freely. Save a private reflection only if you choose.</p>
      </div>
      <div className="alignment-entry-actions">
        <Link href="/alignment" className="btn btn-p">Open today →</Link>
        <Link href="/alignment?view=week" className="au-text-link">Weekly review</Link>
      </div>
    </section>
  );
}
