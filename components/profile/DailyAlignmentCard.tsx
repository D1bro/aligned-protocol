import Link from "next/link";
import { getTodayAlignment } from "@/lib/actions/alignment";

// Near the top of My profile, with or without an audit. Says "saved" only
// when today's entry really has been saved.
export async function DailyAlignmentCard() {
  const today = await getTodayAlignment().catch(() => null);
  return (
    <section className="alignment-entry" aria-labelledby="daily-entry-heading">
      <div>
        <h2 id="daily-entry-heading">Your daily practice</h2>
        <p>Set today&rsquo;s intention, with Duane&rsquo;s audio if you like. Reflect this evening.</p>
        {today?.saved ? (
          <p className="alignment-small alignment-saved">✓ Saved privately for today. <Link href="/alignment">Edit</Link></p>
        ) : (
          <p className="alignment-small">A small daily practice, with saving entirely up to you.</p>
        )}
      </div>
      <div className="alignment-entry-actions">
        <Link href="/alignment" className="btn btn-p">Open today →</Link>
        <Link href="/alignment/journal" className="au-text-link">Journal</Link>
        <Link href="/alignment?view=week" className="au-text-link">Review my week</Link>
      </div>
    </section>
  );
}
