import Link from "next/link";
import { getTodayAlignment } from "@/lib/actions/alignment";
import { JoinButton } from "@/components/membership/JoinButton";
import { offerFor } from "@/lib/offers";

const WINS = [
  { key: "arrive", label: "Listen and arrive" },
  { key: "intention", label: "Today’s intention" },
  { key: "reflect", label: "Evening reflection" },
] as const;

function Mark({ done }: { done: boolean }) {
  return done ? (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="currentColor" /><path d="M5 9.2l2.6 2.6L13 6.4" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
  );
}

// On My profile, for everyone signed in. Practice and Momentum members (and
// staff) see today's three wins as saved; everyone else sees the practice
// locked, with the way to join.
export async function DailyAlignmentCard({ locked = false, joinOpen = false }: { locked?: boolean; joinOpen?: boolean }) {
  if (locked) {
    const practice = offerFor("practice");
    return (
      <section className="alignment-entry dp-entry is-locked" aria-labelledby="daily-entry-heading">
        <div className="dp-entry-text">
          <div className="dp-entry-top">
            <h2 id="daily-entry-heading">Your daily practice</h2>
            <span className="dp-lock">
              <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
              Aligned Practice
            </span>
          </div>
          <p>Three small wins a day: Duane&rsquo;s morning audio, today&rsquo;s intention and an evening reflection, with a private journal.</p>
          <ul className="dp-pills" aria-hidden="true">
            {WINS.map((w) => <li key={w.key}><Mark done={false} />{w.label}</li>)}
          </ul>
        </div>
        <div className="alignment-entry-actions">
          <JoinButton tier="practice" open={joinOpen} label={`Join Practice · ${practice.price} ${practice.per}`} />
          <Link href="/offers" className="au-text-link">See what&rsquo;s included</Link>
        </div>
      </section>
    );
  }

  const today = await getTodayAlignment().catch(() => null);
  const wins = today?.wins ?? { arrive: false, intention: false, reflect: false, count: 0 };
  return (
    <section className="alignment-entry dp-entry" aria-labelledby="daily-entry-heading">
      <div className="dp-entry-text">
        <div className="dp-entry-top">
          <h2 id="daily-entry-heading">Your daily practice</h2>
          <p className="dp-entry-count">{wins.count} of 3 wins today</p>
        </div>
        <ul className="dp-pills">
          {WINS.map((w) => (
            <li key={w.key} className={wins[w.key] ? "is-done" : undefined}>
              <Mark done={wins[w.key]} />{w.label}<span className="sr-only">{wins[w.key] ? ": done" : ": not yet"}</span>
            </li>
          ))}
        </ul>
        <p className="alignment-small">{wins.count === 3 ? "All three today. Well done." : today?.saved ? "Saved privately for today." : "Set today’s intention, with Duane’s audio if you like. Reflect this evening."}</p>
      </div>
      <div className="alignment-entry-actions">
        <Link href="/alignment" className="btn btn-p">{today?.saved ? "Continue today →" : "Open today →"}</Link>
        <div className="dp-entry-links">
          <Link href="/alignment/journal" className="au-text-link">Journal</Link>
          <Link href="/alignment?view=week" className="au-text-link">Review my week</Link>
        </div>
      </div>
    </section>
  );
}
