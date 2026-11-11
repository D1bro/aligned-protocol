import { JoinButton } from "./JoinButton";
import { PRACTICE, offerFor } from "@/lib/offers";

// Shown in place of the daily practice to anyone without Momentum or Focus.
// The daily practice isn't sold on its own (11 Nov 2026): it comes with
// Aligned Momentum, and with Aligned Focus for its 12 weeks.
export function JoinPractice({ open, what }: { open: boolean; what: string }) {
  const momentum = offerFor("momentum");
  return (
    <section className="join-practice" aria-labelledby="join-practice-h">
      <div className="eyebrow"><span className="eydot" /> {PRACTICE.name}</div>
      <h1 id="join-practice-h">{what} is part of Aligned Momentum.</h1>
      <p className="lead">{PRACTICE.tagline} The daily practice comes with Momentum, alongside a live weekly hour with a small group.</p>
      <ul className="join-practice-list">{PRACTICE.includes.map((l) => <li key={l}>{l}</li>)}</ul>
      <p className="join-practice-price"><b>{momentum.price}</b> {momentum.per} · cancel any time · also included in Aligned Focus</p>
      <div className="join-practice-actions">
        <JoinButton tier="momentum" open={open} />
        <a href="/offers" className="au-text-link">Compare the options</a>
      </div>
    </section>
  );
}
