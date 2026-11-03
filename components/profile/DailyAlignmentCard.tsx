import Link from "next/link";
import { JoinButton } from "@/components/membership/JoinButton";
import { offerFor } from "@/lib/offers";

export const WINS = [
  { key: "arrive", label: "Listen and arrive" },
  { key: "intention", label: "Today’s intention" },
  { key: "reflect", label: "Evening reflection" },
] as const;

export function Mark({ done }: { done: boolean }) {
  return done ? (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="currentColor" /><path d="M5 9.2l2.6 2.6L13 6.4" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
  );
}

// On My Space, for free members once their plan is set: the daily practice
// and journal, locked, with the way to join. Members get them in the Today
// and Journal cards instead.
export function DailyAlignmentCard({ joinOpen = false }: { joinOpen?: boolean }) {
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
