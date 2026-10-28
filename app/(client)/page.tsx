import Link from "next/link";
import { getLatestCompletedAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { getPlanState } from "@/lib/actions/clear";
import { getMainGoal } from "@/lib/actions/goals";
import { getAllGoals, getReviews } from "@/lib/actions/checkins";
import { getIdentityStatement } from "@/lib/actions/preferences";
import { getLessonProgress } from "@/lib/actions/learn";
import { PATHS } from "@/lib/learn-content";
import { getCurrentProfile } from "@/lib/session";
import { getMyDetails } from "@/lib/actions/details";
import { greetingName } from "@/lib/details";
import { DetailsPrompt } from "@/components/profile/DetailsPrompt";
import { CoachingCard } from "@/components/profile/CoachingCard";
import { getMyCoaching } from "@/lib/actions/member-coaching";
import { getMyCredits } from "@/lib/actions/packages";
import { DailyAlignmentCard } from "@/components/profile/DailyAlignmentCard";
import { canUseDailyAlignment } from "@/lib/alignment";
import { getMomentumDetails, getMyAccess, joiningOpen } from "@/lib/actions/membership";
import { hasMomentum } from "@/lib/membership";
import { MomentumCard } from "@/components/membership/MomentumCard";
import { LifeMap } from "@/components/audit/LifeMap";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { AreaBadge, IconBadge } from "@/components/ui/Icon";
import { IdentityStatement } from "@/components/ui/IdentityStatement";
import { AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { daysUntil, formatDate, nextAuditDue } from "@/lib/audit-schedule";
import { longDay, nextReview } from "@/lib/review-schedule";
import { weekStreak } from "@/lib/momentum";
import { fallbackOf } from "@/lib/plan-action";

const filled = (v: string | null | undefined) => !!v?.trim();
// "Friday 6 Nov" for a review date (YYYY-MM-DD), and today's date in their zone.
const shortDay = (ymd: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${ymd}T12:00:00Z`));
function todayLabel(zone: string | null | undefined) {
  const opts = { weekday: "long", day: "numeric", month: "long" } as const;
  try { return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: zone || "Europe/London" }).format(new Date()); }
  catch { return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Europe/London" }).format(new Date()); }
}

// The focus area's latest score as a ring out of 10, with the target marked.
function AreaRing({ score, target }: { score: number; target: number | null }) {
  const c = 2 * Math.PI * 38;
  const at = (n: number) => (Math.max(0, Math.min(10, n)) / 10) * c;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`Scored ${score} out of 10${target !== null ? `, aiming for ${target}` : ""}`} className="pfw-ring">
      <circle cx="44" cy="44" r="38" fill="none" stroke="var(--bg5)" strokeWidth="7" />
      <circle cx="44" cy="44" r="38" fill="none" stroke="var(--gold)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${at(score)} ${c}`} transform="rotate(-90 44 44)" />
      {target !== null && target > score ? (
        <circle cx="44" cy="44" r="38" fill="none" stroke="var(--gold2)" strokeOpacity=".45" strokeWidth="7" strokeLinecap="round" strokeDasharray={`0 ${at(target)} 0.01 ${c}`} transform="rotate(-90 44 44)" />
      ) : null}
      <text x="44" y="52" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--text)" className="pfw-ring-n">{score}</text>
    </svg>
  );
}

// My profile, built around the current week. The top answers three things:
// what matters to me now, what am I doing this week, and when will I review
// it. Coaching comes next for coaching clients; the whole-life map, learning
// and support options sit further down. The full plan lives on My plan; the
// history on My journey.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string; reviewed?: string }> }) {
  const { welcome, reviewed } = await searchParams;
  const [profile, details] = await Promise.all([getCurrentProfile(), getMyDetails()]);
  const firstName = greetingName({ preferred_name: details.preferred_name, full_name: profile?.full_name }) ?? undefined;
  const audit = await getLatestCompletedAudit();
  // The optional invitation to add details: only once 0016 is in, only if
  // they've added nothing yet, and never after "Later".
  const offerDetails =
    details.available && !details.promptDismissed && !details.preferred_name && !details.phone && !details.town && !details.country && !details.timezone;
  const editDetails = <Link href="/details" className="au-text-link profile-edit">Edit my details</Link>;

  if (!audit) {
    const mapAreas = await getLifeAreas();
    return (
      <div className="page au-page profile-v2">
        <section className="profile-top" aria-labelledby="profile-top-h">
          <div className="profile-top-text">
            <div className="profile-topline">
              <div className="eyebrow"><span className="eydot" /> My profile</div>
              {editDetails}
            </div>
            <h1 id="profile-top-h" className="au-latest-h">{firstName ? <>Welcome, <em>{firstName}.</em></> : "Welcome."}</h1>
            <p className="lead">
              Start with the Aligned Audit: ten honest questions about where your life stands right now. It takes about
              ten minutes, and gives you your life map and a clear place to start.
            </p>
            <Link href="/audit" className="btn btn-p">Begin my audit →</Link>
          </div>
          <figure className="profile-top-map profile-top-map-empty">
            <div className="au-chart">
              <LifeMap
                scores={mapAreas.map(() => 0)}
                names={mapAreas.map((a) => a.name)}
                labels={mapAreas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
                title="Your life map, waiting for your first audit"
              />
            </div>
            <figcaption>Your life map appears here after your first audit.</figcaption>
          </figure>
        </section>
        {offerDetails ? <DetailsPrompt /> : null}
      </div>
    );
  }

  const [{ responses }, areas, planState, main, allGoals, lessons, identity, coaching, access] = await Promise.all([
    getAuditWithResponses(audit.id),
    getLifeAreas(),
    getPlanState(audit.id),
    getMainGoal(),
    getAllGoals(),
    getLessonProgress(),
    getIdentityStatement(),
    getMyCoaching(),
    getMyAccess(),
  ]);
  const credits = coaching.sessions.length ? await getMyCredits() : null;

  const scoreByArea = new Map(responses.map((r) => [r.life_area_id, r.satisfaction_score as number]));
  const scores = areas.map((a) => scoreByArea.get(a.id) ?? 0);

  // The goal being worked on: the main goal if there is one; otherwise the
  // plan for the latest audit (not started, in progress, or just finished).
  const goal = main?.goal ?? null;
  const planned = !!goal && filled(goal.frequency) && filled(goal.success_criteria);
  const latestPlanArea = areas.find((a) => a.id === (planState.plan?.life_area_id ?? audit.focus_area_id)) ?? null;
  const area = main?.area ?? latestPlanArea;
  const areaIdx = area ? areas.findIndex((a) => a.id === area.id) : -1;
  const baseline = main ? main.baselineScore : areaIdx !== -1 ? scores[areaIdx] : null;
  const target = main ? main.target : baseline !== null ? Math.min(10, planState.plan?.step_up_target ?? baseline + 1) : null;
  const checkIns = main?.checkIns ?? [];
  const latestScore = checkIns.length ? checkIns[checkIns.length - 1].area_score : baseline;
  const goalsDone = allGoals.filter((g) => g.status === "completed").length;

  // This week, once the plan is set: the commitment from their last weekly
  // review (or the plan's action), the fallback, and the next review.
  const reviews = planned ? await getReviews(goal!.id) : null;
  const next = planned && reviews ? nextReview({ start: goal!.created_at ?? audit.completed_at, actionWhen: goal!.action_when, reviews: reviews.all }) : null;
  const run = reviews ? weekStreak(reviews.all) : null;
  const why = main?.plan?.why_it_matters?.trim() || goal?.motivation_text?.trim() || "";
  const commitment = reviews?.weekly.at(-1)?.next_commitment?.trim() || goal?.goal_title?.trim() || goal?.action_text?.trim() || "";
  const fallback = fallbackOf(main?.plan);
  const reviewName = next?.kind === "monthly" ? "monthly review" : "weekly review";

  // Steps from the last shared coaching session that are linked to this goal.
  const lastShared = coaching.summaries[0] ?? null;
  const goalSteps =
    goal && lastShared
      ? coaching.commitments.filter((c) => c.summary_id === lastShared.id && c.owner === "client" && c.status === "open" && c.goal_id === goal.id)
      : [];

  const auditDue = nextAuditDue(audit.completed_at);
  const auditDays = daysUntil(auditDue);

  // Before the plan is set: the one next step.
  const action = goal
    ? { href: "/clear", label: "Finish my plan →" }
    : !area
      ? { href: "/clear", label: "Choose where to start →" }
      : planState.stage === "in_progress"
        ? { href: "/clear", label: `Continue my plan: step ${planState.step} of 5 →` }
        : planState.stage === "done"
          ? { href: "/clear?new=1", label: "Set my next goal →" }
          : { href: "/clear", label: "Build my plan →" };

  const path = PATHS[0];
  const doneSlugs = new Set(lessons.filter((l) => l.completed_at).map((l) => l.lesson_slug));
  const lessonsDone = path.lessons.filter((l) => doneSlugs.has(l.slug)).length;
  const nextLesson = path.lessons.find((l) => !doneSlugs.has(l.slug)) ?? null;

  const strongest = areas
    .map((a, i) => ({ name: AREA_SHORT_NAMES[a.sort_order] ?? a.name, score: scores[i] }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);

  return (
    <div className="page au-page profile-v2">
      {welcome === "plan" && next ? (
        <p className="clear-welcome" role="status"><b>Your plan is saved.</b> Your first review is {longDay(next.date)}.</p>
      ) : null}
      {reviewed ? (
        <p className="clear-welcome" role="status"><b>Review saved.</b> This week is updated with your next commitment.</p>
      ) : null}

      <div className="profile-topline">
        <div className="eyebrow"><span className="eydot" /> {todayLabel(details.timezone)}</div>
        {editDetails}
      </div>
      <h1 id="profile-top-h" className="au-latest-h pf-h">{firstName ? <>Welcome back, <em>{firstName}.</em></> : <>Welcome <em>back.</em></>}</h1>

      {planned && area && next ? (
        <section className="pfw" aria-label="This week">
          <div className="pfw-col">
            <h2 className="pfw-k">What matters now</h2>
            <div className="pfw-area">
              {latestScore !== null ? <AreaRing score={latestScore} target={target} /> : <span className="focus-glow"><AreaBadge order={area.sort_order} size={22} /></span>}
              <div>
                <p className="pfw-area-name">{area.name}</p>
                {latestScore !== null && target !== null ? <p className="pfw-sub">{latestScore} now · aiming for {target}</p> : null}
              </div>
            </div>
            {why ? <p className="pl-quote pfw-why">&ldquo;{why}&rdquo;</p> : null}
          </div>
          <div className="pfw-col is-gold">
            <h2 className="pfw-k">This week I will</h2>
            <p className="pfw-commit">{commitment}</p>
            {goal?.action_when?.trim() || fallback ? (
              <ul className="pfw-tags">
                {goal?.action_when?.trim() && goal.action_when.trim().length <= 48 ? <li className="is-gold">{goal.action_when.trim()}</li> : null}
                {fallback ? <li>Hard week: {fallback.charAt(0).toLowerCase() + fallback.slice(1)}</li> : null}
              </ul>
            ) : null}
            {goalSteps.length ? (
              <div className="next-action-coaching">
                <p className="au-detail-k">Agreed with your coach</p>
                <ul>{goalSteps.map((c) => <li key={c.id}>{c.body}</li>)}</ul>
              </div>
            ) : null}
            <Link href="/clear" className="pfw-link">See my plan →</Link>
          </div>
          <div className="pfw-col">
            <h2 className="pfw-k">{next.kind === "monthly" ? "Next review · monthly" : "Next review"}</h2>
            <div className="pfw-when">
              <p className="pfw-date">{next.due ? "Due now" : shortDay(next.date)}</p>
              <p className="pfw-sub">
                {next.due ? (next.kind === "monthly" ? "Score the area again" : "About a minute") : `${next.daysAway === 1 ? "tomorrow" : `in ${next.daysAway} days`} · ${next.kind === "monthly" ? "score the area again" : "about a minute"}`}
              </p>
            </div>
            {run ? (
              <div className="pfw-run">
                <div className="pfw-bars" role="img" aria-label={`A weekly review in ${run.weeks.filter(Boolean).length} of the last ${run.weeks.length} weeks`}>
                  {run.weeks.map((on, i) => <span key={i} className={on ? "on" : undefined} />)}
                </div>
                <p className="pfw-sub">
                  {run.streak ? `${run.streak} ${run.streak === 1 ? "week" : "weeks"} in a row.` : "Your run starts with your first review."} Every fourth review is the monthly one.
                </p>
              </div>
            ) : null}
            <Link href="/clear/review" className={next.due ? "btn btn-p pfw-btn" : "btn btn-g pfw-btn"}>
              {next.due ? `Do my ${reviewName} →` : "Review early"}
            </Link>
          </div>
        </section>
      ) : (
        <section className="next-action" aria-labelledby="next-action-h">
          <div className="eyebrow">
            <span className="eydot" /> Your next step{area ? ` · ${area.name}` : ""}
          </div>
          {area && baseline !== null && target !== null ? (
            <p className="next-action-meta">Started at {baseline}/10 · working towards {target}</p>
          ) : null}
          <div className="next-action-head">
            {area ? <span className="focus-glow"><AreaBadge order={area.sort_order} size={22} /></span> : null}
            <h2 id="next-action-h">
              {goal
                ? `Finish your plan for ${area?.name ?? "this goal"}`
                : !area
                  ? "Choose one area to work on"
                  : planState.stage === "in_progress"
                    ? `Finish your plan for ${area.name}`
                    : planState.stage === "done"
                      ? "Goal done. What’s next?"
                      : `Turn ${area.name} into one clear plan`}
            </h2>
          </div>
          <p className="next-action-sub">
            {goal || planState.stage === "in_progress"
              ? "Your answers are saved. Pick up where you left off."
              : planState.stage === "done"
                ? "Set your next goal for this area, or choose a new area."
                : "Five guided steps. It ends with one action, when you’ll do it, and a short weekly review."}
          </p>
          <div className="next-action-cta">
            <Link href={action.href} className="btn btn-p">{action.label}</Link>
          </div>
        </section>
      )}

      {main?.otherActive.length ? (
        <p className="next-action-note">
          This is your main goal. You have {main.otherActive.length} other active goal
          {main.otherActive.length === 1 ? "" : "s"} — <Link href="/clear#other-goals">choose your main goal in My plan</Link>.
        </p>
      ) : null}

      {/* Coaching clients: next session, agreed steps, and the coach's suggestion. */}
      <CoachingCard
        data={coaching}
        goals={allGoals.filter((g) => g.status === "active").map((g) => ({ id: g.id, title: g.goal_title?.trim() || "Your goal" }))}
        hasGoal={!!goal}
        credits={credits}
      />

      {/* Today: the daily practice (today's wins for members, locked with the
          way to join for everyone else), then Momentum's weekly session. */}
      <section className="pf-today" aria-labelledby="pf-today-h">
        <h2 id="pf-today-h" className="pf-section-k">Today</h2>
        {canUseDailyAlignment(profile?.role, access.tier) ? <DailyAlignmentCard /> : <DailyAlignmentCard locked joinOpen={await joiningOpen()} />}
        {hasMomentum(access.tier) ? <MomentumCard details={await getMomentumDetails()} /> : null}
      </section>

      {offerDetails ? <DetailsPrompt /> : null}

      {/* Further down: the whole picture, learning and history. */}
      <section className="profile-top pf-lower" aria-labelledby="pf-map-h">
        <div className="profile-top-text">
          <h2 id="pf-map-h" className="pl-h">Your whole life</h2>
          {identity.available ? <IdentityStatement initial={identity.text} /> : null}
          <div className="profile-links">
            <Link href="/audit/results" className="btn btn-g">View my full snapshot</Link>
            <Link href="/audit" className="au-text-link">{auditDays <= 0 ? "Retake the audit" : "Revisit the audit"}</Link>
            <Link href="/summary" className="au-text-link">My journey</Link>
          </div>
          {goalsDone ? (
            <p className="profile-won">
              <span aria-hidden="true">✓</span> {goalsDone} goal{goalsDone === 1 ? "" : "s"} completed
            </p>
          ) : null}
        </div>
        <figure className="profile-top-map">
          <div className="au-chart profile-map-card">
            <div className="profile-score">
              <ScoreRing score={audit.total_score ?? 0} size={112} strokeWidth={9} labelSize={30} denomLabel="/100" />
              <dl className="profile-score-facts">
                <dt className="eyebrow">Whole-life score</dt>
                <dd>Latest audit <b>{formatDate(audit.completed_at)}</b></dd>
                <dd>Strongest <b>{strongest.map((s) => s.name).join(" · ")}</b></dd>
                <dd>Next audit <b>{auditDays <= 0 ? "now" : `around ${formatDate(auditDue)}`}</b></dd>
              </dl>
            </div>
            <LifeMap
              scores={scores}
              names={areas.map((a) => a.name)}
              labels={areas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
              highlightIndex={areaIdx === -1 ? null : areaIdx}
            />
          </div>
          <figcaption>
            Your whole-life map, self-reported.{area ? ` Highlighted: ${area.name}, the area you’re working on.` : ""}
          </figcaption>
        </figure>
      </section>

      <div className="pf-more">
        <section className="profile-card" aria-labelledby="learning-h">
          <h2 id="learning-h"><IconBadge name="book" size={15} /> {nextLesson ? "Continue learning" : "Academy"}</h2>
          <p className="profile-card-k">{path.title}</p>
          {nextLesson ? (
            <Link href={`/learn/${path.slug}/${nextLesson.slug}`} className="profile-lesson">
              <b>{nextLesson.title}</b>
              <span>Lesson {path.lessons.indexOf(nextLesson) + 1} · about {nextLesson.minutes} min</span>
            </Link>
          ) : (
            <p className="profile-lesson-done"><span aria-hidden="true">✓</span> Path complete</p>
          )}
          <div className="learn-bar" role="img" aria-label={`${lessonsDone} of ${path.lessons.length} lessons complete`}>
            <span style={{ width: `${(lessonsDone / path.lessons.length) * 100}%` }} />
          </div>
          <p className="profile-card-foot">
            {lessonsDone} of {path.lessons.length} lessons complete · <Link href="/learn" className="au-text-link">Academy</Link>
          </p>
        </section>
        <section className="profile-card" aria-labelledby="support-h">
          <h2 id="support-h"><IconBadge name="chat" size={15} /> Support with your plan</h2>
          <p className="admin-card-sub">Optional: a daily practice, a live weekly hour with a small group, or six weeks with an Aligned Coach.</p>
          <p className="profile-card-foot"><Link href="/offers" className="au-text-link">Compare the options →</Link></p>
        </section>
      </div>
    </div>
  );
}
