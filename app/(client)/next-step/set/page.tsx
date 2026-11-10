import Link from "next/link";
import { IconBadge } from "@/components/ui/Icon";
import { redirect } from "next/navigation";
import { getBuildContext } from "@/lib/actions/next-step";
import { getMyCoach } from "@/lib/actions/staff-profiles";
import { getCurrentProfile } from "@/lib/session";
import { nextReview, longDay } from "@/lib/review-schedule";
import { stepName, stepsBetween, whyLine } from "@/lib/next-step";
import { NsTrail } from "@/components/next-step/NsMap";
import { SavePlan } from "../SavePlan";
import { NsFilm, NEXT_STEP_FILMS } from "../NsFilm";
import { ShareWithCoach } from "./ShareWithCoach";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" });

// Your Next Step is set: the moment after "Take this step" (Duane, 10 Nov
// 2026). The whole map first, then the line, then the step in their words,
// what happens next, and their coach: share it with them, or meet one.
// Guests save it here.
export default async function NextStepSetPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planId } = await searchParams;
  if (!planId) redirect("/next-step");
  const [ctx, profile] = await Promise.all([getBuildContext(planId), getCurrentProfile()]);
  if (!ctx?.goal?.set_at) redirect(planId ? `/next-step/build?plan=${planId}` : "/next-step");
  const { goal, area, plan, moves } = ctx;
  const start = goal.start_score ?? ctx.score;
  const aim = goal.aim_score;
  const isGuest = profile?.isAnonymous ?? false;
  const coach = !isGuest && profile?.coach_id ? await getMyCoach() : null;
  const coachFirst = coach?.name.trim().split(/\s+/)[0] ?? null;
  const review = nextReview({ start: goal.set_at ?? new Date().toISOString(), actionWhen: null, reviews: [] });
  const first = moves.find((m) => !m.done_at) ?? moves[0];
  const name = stepName(goal);
  const why = whyLine(goal.motivation_text, 200);

  return (
    <div className="page au-page ns-set">
      <NsTrail variant="set" start={start ?? null} aim={aim ?? null} moves={moves.length} />

      <h1 className="ns-set-line">
        You know where you are. You know where you&rsquo;re going.
        <span>Now you&rsquo;ve got a target. Go and hit it.</span>
      </h1>

      <div className="ns-set-step">
        <div className="eyebrow"><span className="eydot" /> Your Next Step · {area.name}</div>
        <p className="ns-set-name">{cap(name)}</p>
        {goal.step_name?.trim() ? <p className="ns-set-full">{cap(goal.goal_title.trim())}</p> : null}
        {why ? (
          <>
            <p className="ns-set-why">&ldquo;{why}&rdquo;</p>
            <p className="au-small">Why it matters, in your words</p>
          </>
        ) : null}
        {start && aim && aim > start ? (
          <p className="ns-set-note">You think it could take you {stepsBetween(start, aim)}, from {start} to {aim}. When it&rsquo;s taken, you&rsquo;ll score {area.name} again and see how far it really moved you.</p>
        ) : null}
      </div>

      <NsFilm clip={NEXT_STEP_FILMS.set} caption="Duane on what happens next" />

      <div className="ns-set-cards">
        {first ? (
          <div className="au-sum-card ns-set-card">
            <IconBadge name="target" />
            <p className="au-detail-k">First move</p>
            <p className="ns-strong">{cap(first.body)}</p>
            <p className="au-small">{first.when_text ? `${first.when_text} · ` : ""}it&rsquo;s in Today on My Space</p>
          </div>
        ) : null}
        <div className="au-sum-card ns-set-card">
          <IconBadge name="calendar" />
          <p className="au-detail-k">Weekly check-in</p>
          <p className="ns-strong">One question: is it closer?</p>
          <p className="au-small">{review.due ? "Due now" : longDay(review.date)} · about a minute</p>
        </div>
        <div className="au-sum-card ns-set-card">
          <IconBadge name="check" />
          <p className="au-detail-k">You&rsquo;ll know you&rsquo;ve arrived when</p>
          <p className="ns-strong">{goal.success_criteria?.trim()}</p>
          <p className="au-small">Then you score it again and choose what&rsquo;s next</p>
        </div>
      </div>

      {isGuest ? (
        <SavePlan firstReview={longDay(review.date)} />
      ) : (
        <>
          <div className="ns-set-coach">
            {coach && coachFirst ? (
              <ShareWithCoach goalId={goal.id} coachFirst={coachFirst} sharedOn={goal.shared_with_coach_at ? short(goal.shared_with_coach_at) : null} />
            ) : (
              <div className="au-sum-card ns-coach-card">
                <p className="ns-coach-h">Want someone in your corner?</p>
                <p>You&rsquo;ve named the step. A coach helps you take it, and holds the line on the weeks it gets hard.</p>
                <div className="ns-coach-act"><Link href="/coaching" className="btn btn-o">Talk to a coach</Link></div>
              </div>
            )}
          </div>
          <div className="ns-set-actions">
            <Link href="/next-step" className="btn btn-p">See it on The Next Step →</Link>
            <Link href={`/next-step/build?plan=${plan.id}&step=3`} className="au-text-link">Change my answers</Link>
          </div>
        </>
      )}
    </div>
  );
}
