import Link from "next/link";
import { redirect } from "next/navigation";
import { getBuildContext } from "@/lib/actions/next-step";
import { getCurrentProfile } from "@/lib/session";
import { nextReview, longDay } from "@/lib/review-schedule";
import { stepsBetween } from "@/lib/next-step";
import { SavePlan } from "../SavePlan";
import { NsFilm, NEXT_STEP_FILMS } from "../NsFilm";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Your Next Step is set: the moment after "Take this step". The step itself,
// why, how it'll feel, where it sits between now and the 10, and what
// happens next. Guests save it here.
export default async function NextStepSetPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planId } = await searchParams;
  if (!planId) redirect("/next-step");
  const [ctx, profile] = await Promise.all([getBuildContext(planId), getCurrentProfile()]);
  if (!ctx?.goal?.set_at) redirect(planId ? `/next-step/build?plan=${planId}` : "/next-step");
  const { goal, area, plan, moves } = ctx;
  const start = goal.start_score ?? ctx.score;
  const aim = goal.aim_score;
  const isGuest = profile?.isAnonymous ?? false;
  const review = nextReview({ start: goal.set_at ?? new Date().toISOString(), actionWhen: null, reviews: [] });
  const first = moves.find((m) => !m.done_at) ?? moves[0];

  return (
    <div className="page au-page ns-set">
      <div className="eyebrow"><span className="eydot" /> Your Next Step · {area.name}</div>
      <h1 className="ns-set-h">{cap(goal.goal_title.trim())}</h1>
      {goal.motivation_text?.trim() ? <p className="ns-set-why">&ldquo;{goal.motivation_text.trim()}&rdquo;</p> : null}
      {goal.feel_text?.trim() ? <p className="ns-set-feel">When it&rsquo;s taken: <span>{goal.feel_text.trim()}</span></p> : null}

      <div className="ns-journey" aria-label={`From ${start ?? "where you are"}, your Next Step${aim ? ` towards ${aim}` : ""}, then your 10`}>
        <div className="ns-j-node"><span className="ns-j-now">{start ?? "–"}</span><small>Where you are</small></div>
        <span className="ns-j-line" aria-hidden="true" />
        <div className="ns-j-node ns-j-step">
          <span className="ns-j-ring" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
          </span>
          <small>Your Next Step{aim ? ` · towards ${aim}` : ""}</small>
        </div>
        <span className="ns-j-line ns-j-far" aria-hidden="true" />
        <div className="ns-j-node"><span className="ns-j-ten">10</span><small>Your 10</small></div>
      </div>
      {start && aim && aim > start ? (
        <p className="ns-set-note">You think it could take you {stepsBetween(start, aim)}, from {start} to {aim}. When it&rsquo;s taken, you&rsquo;ll score {area.name} again and see how far it really moved you.</p>
      ) : null}

      <div className="ns-set-cards">
        {first ? (
          <div className="au-sum-card"><p className="au-detail-k">First move</p><p className="ns-strong">{first.body}{first.when_text ? `, ${first.when_text}` : ""}.</p><p className="au-small">It&rsquo;s on The Next Step with the rest of your moves.</p></div>
        ) : null}
        <div className="au-sum-card"><p className="au-detail-k">Weekly check-in</p><p className="ns-strong">{longDay(review.date)}. One question: is it closer?</p><p className="au-small">About a minute. We&rsquo;ll email you.</p></div>
        <div className="au-sum-card"><p className="au-detail-k">When it&rsquo;s taken</p><p className="ns-strong">{goal.success_criteria?.trim()}</p><p className="au-small">Then you choose what&rsquo;s next.</p></div>
      </div>

      <NsFilm clip={NEXT_STEP_FILMS.set} caption="Duane on what happens next" />

      {isGuest ? (
        <SavePlan firstReview={longDay(review.date)} />
      ) : (
        <div className="ns-set-actions">
          <Link href="/next-step" className="btn btn-p">See it on The Next Step →</Link>
          <Link href={`/next-step/build?plan=${plan.id}&step=3`} className="au-text-link">Change my answers</Link>
        </div>
      )}
    </div>
  );
}
