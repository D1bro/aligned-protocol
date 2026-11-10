import Link from "next/link";
import { getLatestCompletedAudit, getLifeAreas, getAuditWithResponses, getInProgressAudit } from "@/lib/actions/audit";
import { getMyNextSteps, getMyReviews, openNextStep } from "@/lib/actions/next-step";
import { getMyCoaching } from "@/lib/actions/member-coaching";
import { getMyCoach } from "@/lib/actions/staff-profiles";
import { reviewChanges } from "@/lib/next-step-review";
import { ReviewCard } from "@/components/next-step/ReviewCard";
import { YourList } from "@/components/next-step/YourList";
import { getReminderPreference, remindersConfigured } from "@/lib/actions/preferences";
import { getCurrentProfile } from "@/lib/session";
import { ReminderToggle } from "@/components/ui/ReminderToggle";
import { NextStepOverview } from "@/components/next-step/NextStepOverview";

// The Next Step (replaces My Plan): the Next Steps under way, starting
// another, the ones taken, and the 10s they're heading for. Before the
// Protocol is done, it says the Next Step starts from your chart.
export default async function NextStepPage({ searchParams }: { searchParams: Promise<{ choose?: string; suggested?: string; checked?: string }> }) {
  const { choose, suggested, checked } = await searchParams;
  const audit = await getLatestCompletedAudit();
  if (!audit) return <BeforeProtocol started={!!(await getInProgressAudit().catch(() => null))} />;

  const [{ active, taken }, profile] = await Promise.all([getMyNextSteps(), getCurrentProfile()]);
  if (!active.length && !taken.length) return <ChooseArea auditId={audit.id} suggested={suggested ?? null} first />;
  if (choose) return <ChooseArea auditId={audit.id} suggested={suggested ?? null} first={false} />;

  const isGuest = profile?.isAnonymous ?? false;
  const [configured, remindersOn] = isGuest ? [false, null] : await Promise.all([remindersConfigured(), getReminderPreference()]);
  // With a coach: the sharper version from a session, to keep, and the list
  // of what was agreed.
  const coached = !isGuest && !!profile?.coach_id;
  const [reviews, coaching, coach] = coached ? await Promise.all([getMyReviews(), getMyCoaching(), getMyCoach()]) : [[], null, null];
  const coachFirst = coach?.name.trim().split(/\s+/)[0] ?? "Your coach";
  const sentOn = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" });

  return (
    <div className="page au-page ns-home">
      <div className="eyebrow"><span className="eydot" /> The Next Step</div>
      <h1>Where the work <em>begins.</em></h1>
      <p className="lead">One change at a time, in the areas that need it most. Each Next Step gets you out of where you&rsquo;re stuck, and you score the area again once it&rsquo;s taken.</p>
      {checked ? <p className="ns-flash" role="status">Check-in saved.</p> : null}

      {reviews.map((r) => {
        const card = active.find((c) => c.goal.id === r.goalId);
        if (!card) return null;
        const changes = reviewChanges(r.content, {
          title: card.goal.goal_title,
          name: card.goal.step_name ?? null,
          why: card.goal.motivation_text ?? null,
          done: card.goal.success_criteria ?? null,
          aim: card.goal.aim_score ?? null,
          countTarget: card.goal.count_target ?? null,
          moves: card.moves,
        });
        return (
          <ReviewCard
            key={r.id}
            reviewId={r.id}
            coachFirst={coachFirst}
            sentOn={sentOn(r.sentAt)}
            note={r.content.note?.trim() || null}
            changes={changes}
            planHref={card.planId ? `/next-step/build?plan=${card.planId}&step=3` : null}
          />
        );
      })}

      <NextStepOverview active={active} taken={taken} />

      {coaching?.available ? <YourList coaching={coaching} activeGoalIds={active.map((c) => c.goal.id)} /> : null}

      {configured && remindersOn !== null && active.some((c) => c.set) ? (
        <div className="ns-section"><ReminderToggle initial={remindersOn} /></div>
      ) : null}
    </div>
  );
}

async function ChooseArea({ auditId, suggested, first }: { auditId: string; suggested: string | null; first: boolean }) {
  const [areas, { responses }] = await Promise.all([getLifeAreas(), getAuditWithResponses(auditId)]);
  const scoreByArea = new Map(responses.map((r) => [r.life_area_id as string, r.satisfaction_score as number]));
  const lowest = Math.min(...areas.map((a) => scoreByArea.get(a.id) ?? 10));
  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> The Next Step · choose where to start</div>
      <h1>Where will you take your <em>Next Step?</em></h1>
      <p className="lead">
        {first
          ? "Your chart shows where you are. Pick the area where getting unstuck would change the most. It doesn’t have to be your lowest score, but if you choose a different one, it’s worth noticing why."
          : "Pick the area for your next one. You can have Next Steps in more than one area; most people do best with one or two at a time."}
      </p>
      <ol className="au-pick">
        {areas.map((a, i) => {
          const s = scoreByArea.get(a.id) ?? 0;
          return (
            <li key={a.id}>
              <form action={openNextStep.bind(null, a.id)}>
                <button type="submit">
                  <span className="au-list-i">{String(i + 1).padStart(2, "0")}</span>
                  <span className="au-list-name">
                    {a.name}
                    {s === lowest ? <span className="au-low-tag">Lowest score</span> : null}
                    {a.id === suggested ? <span className="au-focus-tag">Suggested by your coach</span> : null}
                  </span>
                  <span className="au-list-score">{s}/10</span>
                </button>
              </form>
            </li>
          );
        })}
      </ol>
      {!first ? <p className="au-foot"><Link href="/next-step" className="au-text-link">← Back to The Next Step</Link></p> : null}
    </div>
  );
}

// Before The Aligned Protocol is completed: a Next Step starts from your
// chart, so say so and point them to it.
function BeforeProtocol({ started }: { started: boolean }) {
  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> The Next Step</div>
      <h1 className="au-latest-h">Your Next Step starts from <em>your chart.</em></h1>
      <p className="lead">
        The Aligned Protocol shows where you are across the ten areas of your life. The Next Step is where the work begins: the one change that gets
        you out of where you&rsquo;re stuck. Take the Protocol first; it takes about 10 minutes.
      </p>
      <p>
        <Link href="/audit" className="btn btn-p">{started ? "Continue The Aligned Protocol →" : "Take The Aligned Protocol →"}</Link>
      </p>
    </div>
  );
}
