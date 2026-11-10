import Link from "next/link";
import type { NextStepCard } from "@/lib/member-view";
import { nextReview, longDay } from "@/lib/review-schedule";
import { stepName, whyLine } from "@/lib/next-step";
import { moveDays } from "@/lib/daily-log";
import { MainGoalButton } from "./MainGoalButton";
import { Moves } from "./Moves";
import { NsTrail } from "./NsMap";

const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const CLOSER: Record<string, string> = { closer: "closer", same: "about the same", further: "further away" };
const DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// One Next Step as a card (Duane, 10 Nov 2026): the trail from where they
// are to their Next Step and their 10, the step by its name, their why,
// the weekly check-in as the one main action, this week's days, and the
// moves. `readOnly`: the console's preview of what the member sees, with
// nothing to press.
export function StepCard({ card, main, several, readOnly = false }: { card: NextStepCard; main: boolean; several: boolean; readOnly?: boolean }) {
  const { goal, moves } = card;
  const oneOffs = moves.filter((m) => !moveDays(m.when_text).length);
  const doneCount = oneOffs.filter((m) => m.done_at).length;
  const review = card.set ? nextReview({ start: goal.set_at ?? goal.created_at ?? new Date().toISOString(), actionWhen: null, reviews: card.checkIns }) : null;
  const started = goal.set_at ?? goal.created_at ?? null;
  const why = whyLine(goal.motivation_text);
  const daysDone = card.week.filter((d) => d.done).length;
  // With moves on set days, each move shows its own week; otherwise one row.
  const perMove = moves.some((m) => moveDays(m.when_text).length);
  return (
    <article className={`au-sum-card ns-card${main ? " ns-card-main" : ""}`}>
      <div className="ns-card-top">
        <span className="au-detail-k">{card.area}</span>
        {card.set && started ? <span className="au-small">Started {short(started)}</span> : null}
      </div>
      {card.set ? <NsTrail variant="card" start={goal.start_score ?? null} aim={goal.aim_score ?? null} /> : null}
      <h2 className="ns-card-h">{cap(stepName(goal))}</h2>
      {goal.step_name?.trim() ? <p className="ns-card-full">{cap(goal.goal_title.trim())}</p> : null}
      {why ? <p className="ns-card-why">&ldquo;{why}&rdquo;</p> : null}

      {card.set && review ? (
        <div className="ns-closer">
          <div>
            <p className="ns-strong">Is it closer this week?</p>
            <p className="au-small">
              {review.due ? "Check-in due now · about a minute" : `Next check-in ${longDay(review.date)}`}
              {card.lastCloser ? ` · last time: ${CLOSER[card.lastCloser] ?? card.lastCloser}` : ""}
            </p>
          </div>
          {readOnly ? null : <Link href={`/next-step/check-in?goal=${goal.id}`} className="btn btn-p">Check in</Link>}
        </div>
      ) : null}

      {card.set && card.count ? (
        <div className="ns-count">
          <p className="au-small">
            <span>Done when: {card.count.target} × {card.count.move}</span>
            <b>{Math.min(card.count.done, card.count.target)} of {card.count.target}</b>
          </p>
          <div className="ns-count-bar" role="progressbar" aria-label="Towards done when" aria-valuemin={0} aria-valuemax={card.count.target} aria-valuenow={Math.min(card.count.done, card.count.target)}>
            <span style={{ width: `${Math.min(100, (card.count.done / card.count.target) * 100)}%` }} />
          </div>
        </div>
      ) : null}

      {card.set && perMove ? null : card.set ? (
        <div className="ns-week">
          <p className="au-detail-k">This week</p>
          <ol aria-label={`This week: ${daysDone ? `moved it forward on ${card.week.filter((d) => d.done).map((d) => DAY[card.week.indexOf(d)]).join(", ")}` : "not ticked off yet"}`}>
            {card.week.map((d, i) => (
              <li key={d.date} className={[d.done ? "d" : "", d.today ? "t" : "", d.future ? "f" : ""].filter(Boolean).join(" ") || undefined} aria-hidden="true">
                {d.letter}
                <span className="sr-only">{DAY[i]}</span>
              </li>
            ))}
          </ol>
          <span className="au-small">{daysDone} of 7 days</span>
        </div>
      ) : (
        <p className="au-small">Not set yet: you&rsquo;re part way through.</p>
      )}

      {moves.length ? (
        <>
          <p className="au-detail-k ns-moves-k">Your moves{oneOffs.length ? ` · ${doneCount} of ${oneOffs.length} one-off${oneOffs.length === 1 ? "" : "s"} done` : ""}</p>
          <Moves moves={moves} weeks={card.moveWeeks} readOnly={readOnly} />
        </>
      ) : null}

      <div className="ns-card-actions" inert={readOnly || undefined}>
        {card.set ? (
          <>
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
