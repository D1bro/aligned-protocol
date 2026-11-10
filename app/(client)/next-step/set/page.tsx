import Link from "next/link";
import Image from "next/image";
import hero from "@/public/media/hero/dusk-mountains.jpg";
import { IconBadge } from "@/components/ui/Icon";
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

  const ten = plan.life_vision?.trim() || null;
  const firstBody = first ? first.body.charAt(0).toUpperCase() + first.body.slice(1) : "";

  return (
    <div className="page au-page ns-set">
      <section className="dusk-hero ns-set-hero">
        <Image src={hero} alt="" fill priority sizes="(max-width: 768px) 100vw, 1100px" placeholder="blur" className="dusk-art" />
        <div className="ns-set-shade" aria-hidden="true" />
        <div className="ns-set-content">
          <div className="eyebrow"><span className="eydot" /> Your Next Step · {area.name}</div>
          <h1 className="ns-set-h">{cap(goal.goal_title.trim())}</h1>
          {goal.motivation_text?.trim() ? <p className="ns-set-why">&ldquo;{goal.motivation_text.trim()}&rdquo;</p> : null}
        </div>
      </section>

      {goal.feel_text?.trim() ? (
        <p className="ns-set-feel"><span>When it&rsquo;s taken</span>{goal.feel_text.trim()}</p>
      ) : null}

      <Staircase start={start ?? null} aim={aim ?? null} ten={ten} />
      {start && aim && aim > start ? (
        <p className="ns-set-note">You think it could take you {stepsBetween(start, aim)}, from {start} to {aim}. When it&rsquo;s taken, you&rsquo;ll score {area.name} again and see how far it really moved you.</p>
      ) : null}

      <div className="ns-set-cards">
        {first ? (
          <div className="au-sum-card ns-set-card">
            <IconBadge name="target" />
            <p className="au-detail-k">First move</p>
            <p className="ns-strong">{firstBody}</p>
            {first.when_text ? <p className="ns-set-when">{first.when_text}</p> : null}
            <p className="au-small">It&rsquo;s on The Next Step with the rest of your moves.</p>
          </div>
        ) : null}
        <div className="au-sum-card ns-set-card">
          <IconBadge name="calendar" />
          <p className="au-detail-k">Weekly check-in</p>
          <p className="ns-strong">One question: is it closer?</p>
          <p className="ns-set-when">{review.due ? "Due now" : longDay(review.date)}</p>
          <p className="au-small">About a minute. We&rsquo;ll email you.</p>
        </div>
        <div className="au-sum-card ns-set-card">
          <IconBadge name="check" />
          <p className="au-detail-k">You&rsquo;ll know it&rsquo;s taken when</p>
          <p className="ns-strong">{goal.success_criteria?.trim()}</p>
          <p className="au-small">Then you choose what&rsquo;s next.</p>
        </div>
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

// Ten steps rising from 1 to 10: the steps they've climbed (solid), the
// steps their Next Step could take them up (glowing), and their 10 at the top.
function Staircase({ start, aim, ten }: { start: number | null; aim: number | null; ten: string | null }) {
  const now = start ?? 0;
  const to = aim && aim > now ? aim : Math.min(10, now + 1);
  const label = `You're at ${now || "the start"}. Your Next Step could take you to ${to}. Your 10 is at the top.`;
  return (
    <div className="ns-stairs" role="img" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        const kind = n <= now ? "done" : n <= to ? "next" : n === 10 ? "ten" : "ahead";
        return (
          <div key={n} className={`ns-stair ns-stair-${kind}`}>
            {n === now ? <span className="ns-stair-tag ns-stair-tag-here">You&rsquo;re here</span> : null}
            {n === to ? <span className="ns-stair-tag ns-stair-tag-next">Your Next Step</span> : null}
            {n === 10 && to < 10 ? <span className="ns-stair-tag ns-stair-tag-ten" title={ten ?? undefined}>Your 10</span> : null}
            <span className="ns-stair-block" style={{ height: `${18 + n * 13}px` }}>
              <b>{n}</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}
