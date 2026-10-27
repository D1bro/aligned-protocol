import Link from "next/link";
import { redirect } from "next/navigation";
import { getMainGoal } from "@/lib/actions/goals";
import { getCurrentProfile } from "@/lib/session";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { PLAN_FILMS, filmOrSoon } from "@/lib/audit-guides";
import { OFFERS } from "@/lib/offers";
import { fallbackOf } from "@/lib/plan-action";
import { firstActionDate, longDay, upcomingReviews } from "@/lib/review-schedule";
import { SavePlan } from "./SavePlan";

const filled = (v: string | null | undefined) => !!v?.trim();

// Your plan is set: the page after step 5. Their answers as one clear
// commitment, what happens next with dates, then saving it (guests) or the
// dashboard, with optional support underneath.
export default async function PlanSetPage() {
  const [main, profile] = await Promise.all([getMainGoal(), getCurrentProfile()]);
  if (!main || !main.area || !filled(main.goal.frequency) || !filled(main.goal.success_criteria)) redirect("/clear");
  const { goal, plan, area } = main;
  const isGuest = profile?.isAnonymous ?? false;
  const score = main.baselineScore ?? 0;
  const target = main.target ?? Math.min(10, score + 1);
  const start = goal.created_at ?? new Date().toISOString();
  const when = goal.action_when?.trim();
  const firstTry = firstActionDate(start, goal.action_when);
  const reviews = upcomingReviews(start, goal.action_when);
  const firstReview = reviews[0] ? longDay(reviews[0].date) : "in a week";
  const monthly = reviews.find((r) => r.kind === "monthly");
  const why = plan?.why_it_matters?.trim() || goal.motivation_text?.trim();
  const paid = OFFERS.filter((o) => o.key !== "clarity");

  return (
    <div className="page au-page ps-page">
      <div className="eyebrow"><span className="eydot" /> &#10003; Five steps done</div>
      <h1 className="ps-h">Your plan is set.</h1>
      <p className="lead">{area.name} · from {score} towards {target}</p>

      <div className="ps-grid">
        <section className="ps-card" aria-label="Your plan">
          <dl>
            <dt>My focus</dt>
            <dd>{area.name}, from {score} towards {target}</dd>
            {why ? (<><dt>Why it matters</dt><dd className="ps-why">&ldquo;{why}&rdquo;</dd></>) : null}
            <dt>My action</dt>
            <dd>{goal.action_text?.trim() ? goal.action_text.trim().charAt(0).toUpperCase() + goal.action_text.trim().slice(1) : goal.goal_title}</dd>
            <dt>When</dt>
            <dd>{when || goal.frequency}</dd>
            {fallbackOf(plan) ? (<><dt>My fallback</dt><dd>{fallbackOf(plan)}</dd></>) : null}
            <dt>My first review</dt>
            <dd>
              {firstReview}
              {monthly ? <span>Monthly review: {longDay(monthly.date)}</span> : null}
            </dd>
          </dl>
        </section>

        <div className="ps-side">
          <GuideVideo clip={filmOrSoon(PLAN_FILMS.P06, "plan-set", "Your plan is set")} caption="Duane on what happens next" />
          <section className="ps-next" aria-labelledby="ps-next-h">
            <h2 id="ps-next-h" className="pl-k">What happens next</h2>
            <ol>
              {firstTry ? <li><b>{longDay(firstTry)}</b> Your first try</li> : null}
              <li><b>{firstReview}</b> Your first weekly review: about a minute, and we&rsquo;ll email you</li>
              {monthly ? <li><b>{longDay(monthly.date)}</b> Your monthly review, where you score {area.name} again</li> : null}
            </ol>
            <p className="au-small">You don&rsquo;t need to solve everything this week. If it turns out to be too much, make it smaller.</p>
          </section>

          {isGuest ? (
            <SavePlan firstReview={firstReview} />
          ) : (
            <div className="ps-save">
              <Link href="/" className="btn btn-p">Go to my dashboard →</Link>
              <Link href="/clear" className="au-text-link">See my full plan</Link>
            </div>
          )}
        </div>
      </div>

      <section className="ps-support" aria-labelledby="ps-support-h">
        <h2 id="ps-support-h" className="pl-k">Want support with it?</h2>
        <p className="au-small">Optional. Your plan works on its own, for free.</p>
        <ul>
          {paid.map((o) => (
            <li key={o.key}>
              <div><b>{o.name}</b><span>{o.short}</span></div>
              <em>{o.price}{o.per ? ` ${o.per}` : ""}</em>
            </li>
          ))}
        </ul>
        <Link href="/offers" className="au-text-link">Compare the options →</Link>
      </section>
    </div>
  );
}
