import Link from "next/link";
import { getLatestCompletedAudit, getLifeAreas, getAuditWithResponses, getInProgressAudit } from "@/lib/actions/audit";
import { getMyNextSteps, openNextStep, type NextStepCard } from "@/lib/actions/next-step";
import { getReminderPreference, remindersConfigured } from "@/lib/actions/preferences";
import { getCurrentProfile } from "@/lib/session";
import { nextReview, longDay } from "@/lib/review-schedule";
import { ReminderToggle } from "@/components/ui/ReminderToggle";
import { MainGoalButton } from "./MainGoalButton";
import { Moves } from "./Moves";

const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const CLOSER: Record<string, string> = { closer: "closer", same: "about the same", further: "further away" };

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
  const heading = [...active, ...taken].filter((c) => c.ten);
  const seenAreas = new Set<string>();

  return (
    <div className="page au-page ns-home">
      <div className="eyebrow"><span className="eydot" /> The Next Step</div>
      <h1>Where the work <em>begins.</em></h1>
      <p className="lead">One change at a time, in the areas that need it most. Each Next Step gets you out of where you&rsquo;re stuck, and you score the area again once it&rsquo;s taken.</p>
      {checked ? <p className="ns-flash" role="status">Check-in saved.</p> : null}

      {active.length ? (
        <div className="ns-cards">
          {active.map((c, i) => <StepCard key={c.goal.id} card={c} main={i === 0} several={active.length > 1} />)}
        </div>
      ) : null}

      <div className="au-sum-card ns-another">
        <div>
          <p className="ns-strong"><b>{active.length ? "Start a Next Step in another area" : "Start your next Next Step"}</b></p>
          <p className="au-small">
            {active.length >= 2
              ? `You have ${active.length} under way. Most people do best with one or two at a time.`
              : "Choose an area from your chart."}
          </p>
        </div>
        <Link href="/next-step?choose=1" className="btn btn-o">Choose an area</Link>
      </div>

      {taken.length ? (
        <section className="ns-section" aria-labelledby="ns-taken-h">
          <h2 id="ns-taken-h" className="au-detail-k">Taken</h2>
          <ul className="ns-rows">
            {taken.map((c) => (
              <li key={c.goal.id}>
                <span>{c.goal.goal_title} <span className="au-small">· {c.area}</span></span>
                <span>
                  {c.goal.start_score && c.goal.taken_score ? <b>{c.goal.start_score} → {c.goal.taken_score}</b> : null}
                  {c.goal.taken_at ? <span className="au-small"> · taken {short(c.goal.taken_at)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {heading.length ? (
        <section className="ns-section" aria-labelledby="ns-heading-h">
          <h2 id="ns-heading-h" className="au-detail-k">Where you&rsquo;re heading</h2>
          <ul className="ns-rows">
            {heading
              .filter((c) => !seenAreas.has(c.area) && seenAreas.add(c.area))
              .map((c) => (
                <li key={c.goal.id}><span><b className="ns-white">{c.area} at a 10:</b> {c.ten}</span></li>
              ))}
          </ul>
        </section>
      ) : null}

      {configured && remindersOn !== null && active.some((c) => c.set) ? (
        <div className="ns-section"><ReminderToggle initial={remindersOn} /></div>
      ) : null}
    </div>
  );
}

function StepCard({ card, main, several }: { card: NextStepCard; main: boolean; several: boolean }) {
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
          <Moves moves={moves} />
        </>
      ) : null}
      <div className="ns-card-actions">
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
      {several && !main ? <MainGoalButton goalId={goal.id} label="Show this one first, and in My Space" /> : null}
    </article>
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
