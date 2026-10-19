import Link from "next/link";
import { getAlignmentHistory } from "@/lib/actions/alignment";

export async function AlignmentReviews() {
  const history = await getAlignmentHistory();
  return (
    <section className="profile-card alignment-journey" aria-labelledby="alignment-reviews-heading">
      <h2 id="alignment-reviews-heading">Your weekly reflections</h2>
      <p className="alignment-small">Private to you in Aligned. Your goal check-ins and audit history stay separate.</p>
      {!history.available ? (
        <p className="alignment-small">Saved reflections are not available yet. You can still use the daily practice.</p>
      ) : history.weekly.length ? (
        <ul className="alignment-history-list">
          {history.weekly.map((review) => (
            <li key={review.id}>
              <span>Week of {new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", year:"numeric", timeZone:"UTC" }).format(new Date(`${review.week_start}T12:00:00Z`))}</span>
              <Link href={`/alignment?view=week&date=${review.week_start}`}>Open review →</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="alignment-small">Your saved weekly reviews will appear here. There is no need to catch up on missed days.</p>
      )}
      <Link href="/alignment?view=week" className="au-text-link">Review this week →</Link>
    </section>
  );
}
