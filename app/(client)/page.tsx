import Link from "next/link";
import { getLatestCompletedAudit, getAuditWithResponses, getLifeAreas, getRecentCompletedAudits } from "@/lib/actions/audit";
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
import { TodayCard } from "@/components/profile/TodayCard";
import { JournalCard } from "@/components/profile/JournalCard";
import { GettingStarted } from "@/components/profile/GettingStarted";
import { MonthIntention } from "@/components/profile/MonthIntention";
import { getMonthIntention, getWeekActions } from "@/lib/actions/planning";
import { intentionSuggestions, weekProgress } from "@/lib/planning";
import { getMonthReflections } from "@/lib/actions/life";
import { addMonths, monthName, yearRow, ymOf } from "@/lib/life-months";
import { localDate } from "@/lib/time";
import { YearStrip } from "@/components/journey/YearStrip";
import { DuskHero } from "@/components/ui/DuskHero";
import { canUseDailyAlignment } from "@/lib/alignment";
import { getMomentumDetails, getMyAccess, joiningOpen } from "@/lib/actions/membership";
import { hasMomentum } from "@/lib/membership";
import { MomentumCard } from "@/components/membership/MomentumCard";
import { LifeMap } from "@/components/audit/LifeMap";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { AreaBadge, Icon, IconBadge } from "@/components/ui/Icon";
import { IdentityStatement } from "@/components/ui/IdentityStatement";
import { AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { daysUntil, formatDate, nextAuditDue } from "@/lib/audit-schedule";
import { longDay, nextReview, plannedDays } from "@/lib/review-schedule";
import { weekStreak } from "@/lib/momentum";
import { fallbackOf } from "@/lib/plan-action";
import { isSet, movesRepeat } from "@/lib/next-step";
import { getMovesForGoal } from "@/lib/actions/next-step";

// "Friday 6 Nov" for a review date (YYYY-MM-DD), and today's date in their zone.
const shortDay = (ymd: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${ymd}T12:00:00Z`));
function todayLabel(zone: string | null | undefined) {
  const opts = { weekday: "long", day: "numeric", month: "long" } as const;
  try { return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: zone || "Europe/London" }).format(new Date()); }
  catch { return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Europe/London" }).format(new Date()); }
}
const monthLabel = (zone: string | null | undefined) => {
  try { return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: zone || "Europe/London" }).format(new Date()); }
  catch { return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date()); }
};
// The dashboard's grid: cells span 2, 3, 4 or all 6 columns on a wide screen
// (two columns on a tablet, one on a phone, in the order they're written).
const Cell = ({ span, children }: { span: 2 | 3 | 4 | 6; children: React.ReactNode }) => <div className={`ms-cell ms-s${span}`}>{children}</div>;




// My Space (brief, 3 Nov 2026): a dashboard that grows with what the member
// has made. New members get the way in (Protocol → Alignment Map → goal →
// first action) instead of empty cards; once their plan is set, the cards run
// in the phone order the brief gives: current focus, this month, today, this
// week, their journey, the journal, the Alignment Map. Every figure is a real
// count or their own self-reported score; nothing is estimated.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string; reviewed?: string }> }) {
  const { welcome, reviewed } = await searchParams;
  const [profile, details, access] = await Promise.all([getCurrentProfile(), getMyDetails(), getMyAccess()]);
  const firstName = greetingName({ preferred_name: details.preferred_name, full_name: profile?.full_name }) ?? undefined;
  // Practice and Momentum members (and staff): today's practice and the journal.
  const practice = canUseDailyAlignment(profile?.role, access.tier);
  const audit = await getLatestCompletedAudit();
  // The optional invitation to add details: only once 0016 is in, only if
  // they've added nothing yet, and never after "Later".
  const offerDetails =
    details.available && !details.promptDismissed && !details.preferred_name && !details.phone && !details.town && !details.country && !details.timezone;
  const editDetails = <Link href="/details" className="au-text-link profile-edit">Edit my details</Link>;

  if (!audit) {
    const [mapAreas, week] = await Promise.all([getLifeAreas(), practice ? getWeekActions() : null]);
    return (
      <div className="page au-page profile-v2">
        <DuskHero>
          <div className="profile-topline">
            <div className="eyebrow"><span className="eydot" /> My Space</div>
            {editDetails}
          </div>
          <h1 className="au-latest-h pf-h">{firstName ? <>Welcome, <em>{firstName}.</em></> : "Welcome."}</h1>
          <p className="dusk-sub">A space to reflect, plan and take meaningful action towards the life you want.</p>
        </DuskHero>
        <div className="ms-grid">
          <Cell span={6}>
            <section className="next-action ms-start" aria-labelledby="next-action-h">
              <div className="ms-start-text">
                <GettingStarted at={0} />
                <h2 id="next-action-h">Start with The Aligned Protocol</h2>
                <p className="next-action-sub">
                  It begins with the Aligned Audit: ten honest questions about where your life stands right now. It takes
                  about ten minutes and gives you your Alignment Map. From there you choose one goal and a first action,
                  and this space fills in as you go.
                </p>
                <div className="next-action-cta">
                  <Link href="/audit" className="btn btn-p">Begin my audit →</Link>
                </div>
              </div>
              <figure className="profile-top-map profile-top-map-empty">
                <div className="au-chart">
                  <LifeMap
                    scores={mapAreas.map(() => 0)}
                    names={mapAreas.map((a) => a.name)}
                    labels={mapAreas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
                    title="Your Alignment Map, waiting for your first audit"
                  />
                </div>
                <figcaption>Your Alignment Map appears here after your audit.</figcaption>
              </figure>
            </section>
          </Cell>
          {practice ? (
            <>
              <Cell span={3}><TodayCard action="" actionWhen={null} fallback={null} coachSteps={[]} practice goalId={null} goals={[]} week={week!} /></Cell>
              <Cell span={3}><JournalCard /></Cell>
            </>
          ) : null}
        </div>
        {offerDetails ? <DetailsPrompt /> : null}
      </div>
    );
  }

  const [{ responses }, areas, planState, main, allGoals, lessons, identity, coaching, audits, intention, week, reflections] = await Promise.all([
    getAuditWithResponses(audit.id),
    getLifeAreas(),
    getPlanState(audit.id),
    getMainGoal(),
    getAllGoals(),
    getLessonProgress(),
    getIdentityStatement(),
    getMyCoaching(),
    getRecentCompletedAudits(50),
    getMonthIntention(),
    getWeekActions(),
    getMonthReflections(),
  ]);
  const credits = coaching.sessions.length ? await getMyCredits() : null;

  const scoreByArea = new Map(responses.map((r) => [r.life_area_id, r.satisfaction_score as number]));
  const scores = areas.map((a) => scoreByArea.get(a.id) ?? 0);

  // The goal being worked on: the main goal if there is one; otherwise the
  // plan for the latest audit (not started, in progress, or just finished).
  const goal = main?.goal ?? null;
  const planned = isSet(goal);
  const latestPlanArea = areas.find((a) => a.id === (planState.plan?.life_area_id ?? audit.focus_area_id)) ?? null;
  const area = main?.area ?? latestPlanArea;
  const areaIdx = area ? areas.findIndex((a) => a.id === area.id) : -1;
  const baseline = main ? main.baselineScore : areaIdx !== -1 ? scores[areaIdx] : null;
  const target = main ? main.target : baseline !== null ? Math.min(10, planState.plan?.step_up_target ?? baseline + 1) : null;
  const checkIns = main?.checkIns ?? [];
  const latestScore = checkIns.length ? checkIns[checkIns.length - 1].area_score : baseline;
  const goalsDone = allGoals.filter((g) => g.status === "completed").length;
  const activeGoals = allGoals.filter((g) => g.status === "active").map((g) => ({ id: g.id, title: g.goal_title?.trim() || "Your goal" }));
  // Still finding their way in: no plan set yet and no goal ever finished.
  const starting = !planned && goalsDone === 0;

  // This week, once the plan is set: the commitment from their last weekly
  // review (or the plan's action), the fallback, and the next review.
  const reviews = planned ? await getReviews(goal!.id) : null;
  // Weekly check-ins only: the area is scored again when the Next Step is taken.
  const next = planned && reviews ? nextReview({ start: goal!.set_at ?? goal!.created_at ?? audit.completed_at, actionWhen: goal!.action_when, reviews: reviews.weekly, monthly: false }) : null;
  // Today's action: the first move not yet done (an old plan's action is its first move).
  const moves = planned ? await getMovesForGoal(goal!.id) : [];
  const openMove = moves.find((m) => !m.done_at) ?? null;
  // An old weekly review's commitment counts only for a plan with no moves;
  // with The Next Step, the moves are what this week is about.
  const reviewCommitment = moves.length ? "" : reviews?.weekly.at(-1)?.next_commitment?.trim() || "";
  const run = reviews ? weekStreak(reviews.all) : null;
  const why = main?.plan?.why_it_matters?.trim() || goal?.motivation_text?.trim() || "";

  // Today's action is their next open move. Once a Next Step has moves, the
  // old plan's action (still stored on the goal) is never shown again.
  const commitment = reviewCommitment || openMove?.body.trim() || (moves.length ? "" : goal?.action_text?.trim() || "");
  const commitmentWhen = reviewCommitment ? null : openMove ? (movesRepeat(openMove.when_text) ? openMove.when_text : null) : goal?.action_when ?? null;
  // A one-off move (no days to repeat on) shows every day until it's done,
  // and ticking it ticks the move itself.
  const todayMoveId = !reviewCommitment && openMove && !movesRepeat(openMove.when_text) ? openMove.id : null;
  const allMovesDone = planned && moves.length > 0 && !openMove && goal
    ? { addHref: goal.clear_plan_id ? `/next-step/build?plan=${goal.clear_plan_id}&step=5` : "/next-step", takenHref: `/next-step/taken?goal=${goal.id}` }
    : null;
  const checkInHref = goal ? `/next-step/check-in?goal=${goal.id}` : "/next-step";
  const fallback = fallbackOf(main?.plan);
  const reviewName = "weekly check-in";
  // The week's actions, counted: planned days of the plan's action plus their own.
  const progress = week.available ? weekProgress(week.weekStart, reviewCommitment ? [] : plannedDays(commitmentWhen), week.actions) : null;

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
    ? { href: "/next-step", label: "Finish setting my Next Step →" }
    : !area
      ? { href: "/next-step", label: "Choose where to start →" }
      : planState.stage === "in_progress"
        ? { href: "/next-step", label: `Carry on: step ${planState.step} of 5 →` }
        : planState.stage === "done"
          ? { href: "/next-step?choose=1", label: "Set my next Next Step →" }
          : { href: "/next-step", label: "Set my Next Step →" };

  const path = PATHS[0];
  const doneSlugs = new Set(lessons.filter((l) => l.completed_at).map((l) => l.lesson_slug));
  const lessonsDone = path.lessons.filter((l) => doneSlugs.has(l.slug)).length;
  const nextLesson = path.lessons.find((l) => !doneSlugs.has(l.slug)) ?? null;

  // The suggestion when no area is chosen yet: the lowest score (first on a tie).
  const lowestScore = scores.length ? Math.min(...scores) : null;
  const roomToGrow = lowestScore !== null ? { name: areas[scores.indexOf(lowestScore)].name, score: lowestScore } : null;

  const strongest = areas
    .map((a, i) => ({ name: AREA_SHORT_NAMES[a.sort_order] ?? a.name, score: scores[i] }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);

  const firstAudit = audits.at(-1) ?? audit;
  // The current chapter (this year) and, early in a month, an invitation to
  // look back on the last one if they haven't.
  const todayYmd = localDate(new Date());
  const thisYm = ymOf(todayYmd);
  const lastYm = addMonths(thisYm, -1);
  const askLastMonth = reflections.available && Number(todayYmd.slice(8, 10)) <= 10 && !reflections.months[lastYm];
  const showJourney = planned || audits.length > 1;
  const lockedPractice = !practice && planned;
  // The small cards after the first row share a row with the Alignment Map.
  const beforeMap = (planned ? 0 : (practice ? 2 : 0) + (showJourney ? 1 : 0)) + (planned && practice ? 1 : 0);
  const mapSpan = beforeMap === 1 ? 4 : 6;
  const smallSpan = !planned && beforeMap === 2 ? 3 : 2;

  return (
    <div className="page au-page profile-v2">
      {welcome === "plan" && next ? (
        <p className="clear-welcome" role="status"><b>Your Next Step is saved.</b> Your first check-in is {longDay(next.date)}.</p>
      ) : null}
      {welcome === "saved" ? (
        <p className="clear-welcome" role="status"><b>Your starting point is saved.</b> Your Alignment Map from {formatDate(audit.completed_at)} is here whenever you want it.</p>
      ) : null}
      {reviewed ? (
        <p className="clear-welcome" role="status"><b>Check-in saved.</b></p>
      ) : null}

      <DuskHero>
        <div className="profile-topline">
          <div className="eyebrow"><span className="eydot" /> {todayLabel(details.timezone)}</div>
          {editDetails}
        </div>
        <h1 id="profile-top-h" className="au-latest-h pf-h">{welcome === "saved" ? (firstName ? <>Welcome, <em>{firstName}.</em></> : <><em>Welcome.</em></>) : firstName ? <>Welcome back, <em>{firstName}.</em></> : <>Welcome <em>back.</em></>}</h1>
        <p className="dusk-sub">A space to reflect, plan and take meaningful action towards the life you want.</p>
      </DuskHero>

      <div className="ms-grid">
        {planned && area && next ? (
          <>
            {/* 1. Current focus */}
            <Cell span={4}>
              <section className="next-action ms-focus" aria-labelledby="next-action-h">
                <div className="eyebrow"><span className="eydot" /> Current focus · {area.name}</div>
                {latestScore !== null && target !== null ? (
                  <p className="next-action-meta">{latestScore}/10 now · aiming for {target}</p>
                ) : null}
                <div className="next-action-head">
                  <span className="focus-glow"><AreaBadge order={area.sort_order} size={22} /></span>
                  <h2 id="next-action-h">{goal?.goal_title?.trim() || commitment}</h2>
                </div>
                {why ? <p className="next-action-sub">Why it matters: <em className="pf-why">&ldquo;{why}&rdquo;</em></p> : null}
                <div className="next-action-cta">
                  <Link href="/next-step" className="btn btn-g">See my Next Step →</Link>
                </div>
                {main?.otherActive.length ? (
                  <p className="next-action-note">
                    You have {main.otherActive.length} other Next Step
                    {main.otherActive.length === 1 ? "" : "s"} under way: <Link href="/next-step">choose which shows here on The Next Step</Link>.
                  </p>
                ) : null}
              </section>
            </Cell>

            {/* 2. This month: the goal's measured progress and the monthly review. */}
            <Cell span={2}>
              <section className="pf-tile ms-tile" aria-labelledby="ms-month-h">
                <div className="ms-head">
                  <Icon name="calendar" size={18} />
                  <h2 id="ms-month-h">This Month</h2>
                  <span className="ms-head-end">{monthLabel(details.timezone)}</span>
                </div>
                {intention.available ? (
                  <MonthIntention
                    initial={intention.intention?.intention ?? null}
                    suggestions={intentionSuggestions([{ area: area.name, title: goal?.goal_title ?? null }])}
                    goalId={goal?.id ?? null}
                  />
                ) : null}
                {baseline !== null && latestScore !== null && target !== null ? (
                  <dl className="ms-facts">
                    <div><dt>Started</dt><dd>{baseline}/10</dd></div>
                    <div><dt>Now</dt><dd>{latestScore}/10</dd></div>
                    <div><dt>Aiming for</dt><dd>{target}/10</dd></div>
                  </dl>
                ) : null}
                <p className="pf-sub">When your Next Step is taken, you&rsquo;ll score {area.name} again.</p>
                {moves.length ? <p className="ms-note">{moves.filter((m) => m.done_at).length} of {moves.length} moves done</p> : null}
              </section>
            </Cell>

            {/* 3. Today: the plan's action (and the daily practice for members). */}
            <Cell span={2}>
              <TodayCard action={commitment} actionWhen={commitmentWhen} moveId={todayMoveId} movesDone={allMovesDone} fallback={fallback} coachSteps={goalSteps} practice={practice} goalId={goal?.id ?? null} goals={activeGoals} week={week} />
            </Cell>

            {/* 4. This week: the weekly review and the run of reviews. */}
            <Cell span={2}>
              <section className="pf-tile ms-tile" aria-labelledby="ms-week-h">
                <div className="ms-head">
                  <Icon name="target" size={18} />
                  <h2 id="ms-week-h">This Week</h2>
                </div>
                {/* The focus their last weekly review set; until then it's the goal above. */}
                {reviewCommitment ? (
                  <div className="ms-intention">
                    <p className="profile-card-k">Weekly focus</p>
                    <p className="pf-commit">{reviewCommitment}</p>
                  </div>
                ) : null}
                {progress && progress.total ? (
                  <p className="ms-note"><b>{progress.done} of {progress.total}</b> action{progress.total === 1 ? "" : "s"} done this week</p>
                ) : null}
                <p className="pf-sub">
                  <b>{next.due ? `Your ${reviewName} is due.` : `Next ${reviewName}: ${shortDay(next.date)}.`}</b>{" "}
                  {next.due ? "About a minute. One question: is it closer?" : next.daysAway === 1 ? "Tomorrow." : `In ${next.daysAway} days.`}
                </p>
                {run ? (
                  <>
                    <span className="pf-bars" role="img" aria-label={`A weekly check-in in ${run.weeks.filter(Boolean).length} of the last ${run.weeks.length} weeks`}>
                      {run.weeks.map((on, i) => <span key={i} className={on ? "on" : undefined} />)}
                    </span>
                    <p className="ms-note">
                      Check-ins in {run.weeks.filter(Boolean).length} of the last {run.weeks.length} weeks
                      {run.streak > 1 ? ` · ${run.streak} in a row` : ""}
                    </p>
                  </>
                ) : null}
                {next.due ? (
                  <Link href={checkInHref} className="btn btn-p">Do my {reviewName} →</Link>
                ) : (
                  <Link href={checkInHref} className="au-text-link">Check in early</Link>
                )}
              </section>
            </Cell>
          </>
        ) : (
          <Cell span={6}>
            {/* Before the plan is set: the one next step, with where they are on the way in. */}
            <section className="next-action" aria-labelledby="next-action-h">
              {starting ? <GettingStarted at={goal ? 3 : 2} /> : (
                <div className="eyebrow"><span className="eydot" /> Your next step{area ? ` · ${area.name}` : ""}</div>
              )}
              {area && baseline !== null && target !== null ? (
                <p className="next-action-meta">{area.name} · started at {baseline}/10 · working towards {target}</p>
              ) : null}
              <div className="next-action-head">
                {area ? <span className="focus-glow"><AreaBadge order={area.sort_order} size={22} /></span> : null}
                <h2 id="next-action-h">
                  {goal
                    ? `Finish setting your Next Step for ${area?.name ?? "this area"}`
                    : !area
                      ? "Choose your first area to work on"
                      : planState.stage === "in_progress"
                        ? `Finish setting your Next Step for ${area.name}`
                        : planState.stage === "done"
                          ? "Next Step taken. What’s next?"
                          : `Set your Next Step for ${area.name}`}
                </h2>
              </div>
              <p className="next-action-sub">
                {goal || planState.stage === "in_progress"
                  ? "Your answers are saved. Pick up where you left off."
                  : planState.stage === "done"
                    ? "Set your next one here, or choose another area."
                    : !area && roomToGrow
                      ? `Many people start with the area that has the most room to grow; for you that’s ${roomToGrow.name}, ${roomToGrow.score}/10. It’s your choice. Your Next Step is the one change that gets you out of where you’re stuck.`
                      : "Five short screens. It ends with your Next Step, the moves that get you there, and a weekly check-in."}
              </p>
              <div className="next-action-cta">
                <Link href={action.href} className="btn btn-p">{action.label}</Link>
              </div>
            </section>
          </Cell>
        )}

        {/* Coaching clients: next session, agreed steps, and the coach's suggestion. */}
        <CoachingCard
          data={coaching}
          goals={allGoals.filter((g) => g.status === "active").map((g) => ({ id: g.id, title: g.goal_title?.trim() || "Your goal" }))}
          hasGoal={!!goal}
          credits={credits}
        />
        {hasMomentum(access.tier) ? <MomentumCard details={await getMomentumDetails()} /> : null}

        {/* Members before their plan is set still have today's practice. */}
        {!planned && practice ? (
          <Cell span={smallSpan}><TodayCard action="" actionWhen={null} fallback={null} coachSteps={[]} practice goalId={null} goals={activeGoals} week={week} /></Cell>
        ) : null}

        {/* 5. My Journey, in brief. */}
        {showJourney ? (
          <Cell span={smallSpan}>
            <section className="pf-tile ms-tile" aria-labelledby="ms-journey-h">
              <div className="ms-head">
                <Icon name="journey" size={18} />
                <h2 id="ms-journey-h">My Journey</h2>
              </div>
              <YearStrip months={yearRow(Number(thisYm.slice(0, 4)), thisYm)} reflections={reflections.months} label={`Your current chapter, ${thisYm.slice(0, 4)}`} />
              {askLastMonth ? (
                <Link href={`/journey/months/${lastYm}`} className="au-text-link">How was {monthName(lastYm).split(" ")[0]}? Look back on it →</Link>
              ) : null}
              <p className="pf-sub">Since {formatDate(firstAudit.completed_at)}</p>
              <dl className="ms-facts">
                <div><dt>{audits.length === 1 ? "Audit" : "Audits"}</dt><dd>{audits.length}</dd></div>
                <div><dt>Goals done</dt><dd>{goalsDone}</dd></div>
                {audits.length > 1 ? (
                  <div><dt>Whole-life</dt><dd>{firstAudit.total_score ?? 0} → {audit.total_score ?? 0}</dd></div>
                ) : null}
              </dl>
              <Link href="/journey" className="btn btn-g">Explore my journey →</Link>
            </section>
          </Cell>
        ) : null}

        {/* 6. The journal (members), or the daily practice offered once the plan is set. */}
        {practice ? <Cell span={smallSpan}><JournalCard /></Cell> : lockedPractice ? <DailyAlignmentCard joinOpen={await joiningOpen()} /> : null}

        {/* 7. The Alignment Map, in brief. */}
        <Cell span={mapSpan}>
          <section className="pf-tile ms-tile ms-map" aria-labelledby="pf-map-h">
            <div className="ms-map-text">
              <div className="ms-head">
                <Icon name="compass" size={18} />
                <h2 id="pf-map-h">Your Alignment Map</h2>
              </div>
              <div className="profile-score">
                <ScoreRing score={audit.total_score ?? 0} size={96} strokeWidth={8} labelSize={26} denomLabel="/100" />
                <dl className="profile-score-facts">
                  <dt className="eyebrow">Whole-life score</dt>
                  <dd>Latest audit <b>{formatDate(audit.completed_at)}</b></dd>
                  <dd>Strongest <b>{strongest.map((s) => s.name).join(" · ")}</b></dd>
                  <dd>Next audit <b>{auditDays <= 0 ? "now" : `around ${formatDate(auditDue)}`}</b></dd>
                </dl>
              </div>
              {identity.available ? <IdentityStatement initial={identity.text} /> : null}
              <div className="profile-links">
                <Link href="/audit/results" className="btn btn-g">View my full snapshot</Link>
                <Link href="/audit" className="au-text-link">{auditDays <= 0 ? "Retake the audit" : "Revisit the audit"}</Link>
              </div>
            </div>
            <figure className="profile-top-map">
              <div className="au-chart">
                <LifeMap
                  scores={scores}
                  names={areas.map((a) => a.name)}
                  labels={areas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
                  highlightIndex={areaIdx === -1 ? null : areaIdx}
                />
              </div>
              <figcaption>
                Self-reported.{area ? ` Highlighted: ${area.name}, the area you’re working on.` : ""}
              </figcaption>
            </figure>
          </section>
        </Cell>
      </div>

      {offerDetails ? <DetailsPrompt /> : null}

      {/* Further down: learning, and the support on offer. */}
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
