import Link from "next/link";
import type { NextStepCard } from "@/lib/member-view";
import { nextReview, longDay } from "@/lib/review-schedule";
import { MainGoalButton } from "./MainGoalButton";
import { Moves } from "./Moves";

const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const CLOSER: Record<string, string> = { closer: "closer", same: "about the same", further: "further away" };

// One Next Step as a card. `readOnly`: the console's preview of what the
// member sees, with the moves shown but nothing to press.
export function StepCard({ card, main, several, readOnly = false }: { card: NextStepCard; main: boolean; several: boolean; readOnly?: boolean }) {
  const { goal, moves } = card;
  const doneCount = moves.filter((m) => m.done_at).length;
  const start = goal.start_score;
  const aim = goal.aim_score;
  const review = card.set ? nextReview({ start: goal.set_at ?? goal.created_at ?? new Date().toISOString(), actionWhen: null, reviews: card.checkIns }) : null;
  return (
    <article className={`au-sum-card ns-card${main ? " ns-card-main" : ""}`}>
      <p className="au-detail-k">
        {card.area}
        {start ? ` · ${start}` : ""}
        {start && aim && aim > start ? ` → aiming for ${aim}` : ""}
      </p>
      <h2 className="ns-card-h">{goal.goal_title}</h2>
      {card.set ? (
        <p className="au-small">
          {goal.set_at ? `Started ${short(goal.set_at)}` : goal.created_at ? `Started ${short(goal.created_at)}` : ""}
          {card.lastCloser ? ` · last check-in: ${CLOSER[card.lastCloser] ?? card.lastCloser}` : ""}
          {review ? ` · next check-in ${review.due ? "due now" : longDay(review.date)}` : ""}
        </p>
      ) : (
        <p className="au-small">Not set yet: you&rsquo;re part way through.</p>
      )}
      {moves.length ? (
        <>
          <p className="au-detail-k ns-moves-k">Moves · {doneCount} of {moves.length} done</p>
          <div className="ns-seg" aria-hidden="true">{moves.map((m) => <span key={m.id} className={m.done_at ? "d" : undefined} />)}</div>
          <Moves moves={moves} readOnly={readOnly} />
        </>
      ) : null}
      <div className="ns-card-actions" inert={readOnly || undefined}>
        {card.set ? (
          <>
            <Link href={`/next-step/check-in?goal=${goal.id}`} className="btn btn-p">Check in</Link>
            <Link href={`/next-step/taken?goal=${goal.id}`} className="btn btn-o">It&rsquo;s taken</Link>
            {card.planId ? <Link href={`/next-step/build?plan=${card.planId}&step=3`} className="au-text-link">Change it</Link> : null}
          </>
        ) : card.planId ? (
          <Link href={`/next-step/build?plan=${card.planId}`} className="btn btn-p">Carry on setting it →</Link>
        ) : null}
      </div>
      {several && !main && !readOnly ? <MainGoalButton goalId={goal.id} label="Show this one first, and in My Space" /> : null}
    </article>
  );
}

