import { JoinButton } from "./JoinButton";
import { offerFor } from "@/lib/offers";

// Shown in place of the daily practice to anyone without Practice or Momentum.
export function JoinPractice({ open, what }: { open: boolean; what: string }) {
  const practice = offerFor("practice");
  return (
    <section className="join-practice" aria-labelledby="join-practice-h">
      <div className="eyebrow"><span className="eydot" /> Aligned Practice</div>
      <h1 id="join-practice-h">{what} is part of Aligned Practice.</h1>
      <p className="lead">{practice.tagline} A daily intention with Duane&rsquo;s audio, an evening reflection, a private journal, and the tools to go deeper.</p>
      <ul className="join-practice-list">{practice.includes.map((l) => <li key={l}>{l}</li>)}</ul>
      <p className="join-practice-price"><b>{practice.price}</b> {practice.per} · founding price · cancel any time</p>
      <div className="join-practice-actions">
        <JoinButton tier="practice" open={open} />
        <a href="/offers" className="au-text-link">Compare all the options</a>
      </div>
    </section>
  );
}
