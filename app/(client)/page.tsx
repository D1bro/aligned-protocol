import Link from "next/link";
import { getLatestCompletedAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { getPlanState } from "@/lib/actions/clear";
import { getMainGoal } from "@/lib/actions/goals";
import { getAllGoals } from "@/lib/actions/checkins";
import { getIdentityStatement } from "@/lib/actions/preferences";
import { getLessonProgress } from "@/lib/actions/learn";
import { PATHS } from "@/lib/learn-content";
import { getCurrentProfile } from "@/lib/session";
import { getMyDetails } from "@/lib/actions/details";
import { greetingName } from "@/lib/details";
import { DetailsPrompt } from "@/components/profile/DetailsPrompt";
import { LifeMap } from "@/components/audit/LifeMap";
import { IdentityStatement } from "@/components/ui/IdentityStatement";
import { ProfileSteps, type Step } from "@/components/profile/ProfileSteps";
import { AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { daysUntil, formatDate, nextAuditDue, nextCheckInDue } from "@/lib/audit-schedule";

const filled = (v: string | null | undefined) => !!v?.trim();

// My profile answers: what am I working on, and what should I do next?
// Order: welcome, one next action, real progress, learning, then the wider
// audit context. The full plan lives on My plan; the history on My journey.
export default async function ProfilePage() {
  const [profile, details] = await Promise.all([getCurrentProfile(), getMyDetails()]);
  const firstName = greetingName({ preferred_name: details.preferred_name, full_name: profile?.full_name }) ?? undefined;
  const audit = await getLatestCompletedAudit();
  // The optional invitation to add details: only once 0016 is in, only if
  // they've added nothing yet, and never after "Later".
  const offerDetails =
    details.available && !details.promptDismissed && !details.preferred_name && !details.phone && !details.town && !details.country && !details.timezone;
  const editDetails = <Link href="/details" className="au-text-link profile-edit">Edit my details</Link>;

  if (!audit) {
    return (
      <div className="page au-page">
        <div className="profile-topline">
          <div className="eyebrow"><span className="eydot" /> My profile</div>
          {editDetails}
        </div>
        <h1 className="au-latest-h">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
        <p className="lead">
          Start with the Aligned Audit: ten honest questions about where your life stands right now. It takes about
          ten minutes, and gives you a snapshot and a clear place to start.
        </p>
        <Link href="/audit" className="btn btn-p">Begin my audit →</Link>
        {offerDetails ? <DetailsPrompt /> : null}
      </div>
    );
  }

  const [{ responses }, areas, planState, main, allGoals, lessons, identity] = await Promise.all([
    getAuditWithResponses(audit.id),
    getLifeAreas(),
    getPlanState(audit.id),
    getMainGoal(),
    getAllGoals(),
    getLessonProgress(),
    getIdentityStatement(),
  ]);

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
  const lastCheckIn = checkIns[checkIns.length - 1];
  const checkInDue = goal && planned ? nextCheckInDue(lastCheckIn?.created_at ?? goal.created_at ?? audit.completed_at) : null;
  const checkInDays = checkInDue ? daysUntil(checkInDue) : null;
  const checkInNow = checkInDays !== null && checkInDays <= 0;
  const when = goal?.action_when?.trim() || goal?.frequency?.trim() || null;
  const practised = checkIns.filter((c) => c.did_it !== "not_yet");
  const goalsDone = allGoals.filter((g) => g.status === "completed").length;

  const auditDue = nextAuditDue(audit.completed_at);
  const auditDays = daysUntil(auditDue);

  // The one next action.
  const action = planned
    ? checkInNow
      ? { href: "/clear/check-in", label: "Do my goal check-in →", quiet: { href: "/clear", label: "Open my plan" } }
      : { href: "/clear", label: "Open my plan →", quiet: { href: "/clear/check-in", label: "Check in early" } }
    : goal
      ? { href: "/clear", label: "Finish my plan →", quiet: null }
      : !area
        ? { href: "/clear", label: "Choose where to start →", quiet: null }
        : planState.stage === "in_progress"
          ? { href: "/clear", label: `Continue my plan — step ${planState.step} of 5 →`, quiet: null }
          : planState.stage === "done"
            ? { href: "/clear?new=1", label: "Set my next goal →", quiet: { href: "/clear", label: "See my last plan" } }
            : { href: "/clear", label: "Make my plan →", quiet: null };

  const steps: Step[] = [
    { label: "Audit completed", state: "done", detail: `${formatDate(audit.completed_at)} · ${audit.total_score ?? 0}/100` },
    planned
      ? { label: "Plan created", state: "done", detail: `Set ${formatDate(goal!.created_at!)}` }
      : {
          label: "Plan created",
          state: "current",
          detail:
            goal || planState.stage === "in_progress"
              ? "Started — your answers are saved"
              : planState.stage === "done"
                ? "Last goal closed — set your next one"
                : "Five short questions, about ten minutes",
        },
    planned
      ? practised.length
        ? {
            label: "Action underway",
            state: "done",
            detail: `Recorded at your goal check-in, ${formatDate(practised[practised.length - 1].created_at)}`,
          }
        : { label: "Action underway", state: "current", detail: "Not recorded yet — your goal check-in records what you’ve done" }
      : { label: "Action underway", state: "todo", detail: "Once your plan is set" },
    planned && checkInDue
      ? {
          label: "Review next",
          state: checkInNow ? "current" : "todo",
          stateLabel: checkInNow ? "Due now" : "Upcoming",
          detail: `Goal check-in · ${checkInNow ? "due now" : formatDate(checkInDue)}`,
        }
      : { label: "Review next", state: "todo", detail: "Monthly goal check-in, once your plan is set" },
  ];

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
      <header className="profile-welcome">
        <div className="profile-topline">
          <div className="eyebrow"><span className="eydot" /> My profile</div>
          {editDetails}
        </div>
        <h1 className="au-latest-h">{firstName ? `Welcome back, ${firstName}.` : "Welcome back."}</h1>
        <p className="profile-sub">Start from where you are today.</p>
        {identity.available ? <IdentityStatement initial={identity.text} /> : null}
      </header>

      <div className="profile-grid">
        <section className="next-action" aria-labelledby="next-action-h">
          <div className="eyebrow">
            <span className="eydot" /> {planned ? "Your next action" : "Your next step"}{area ? ` · ${area.name}` : ""}
          </div>
          {area && baseline !== null && target !== null ? (
            <p className="next-action-meta">Started at {baseline}/10 · working towards {target}</p>
          ) : null}
          <h2 id="next-action-h">
            {planned
              ? goal!.action_text?.trim() || goal!.goal_title?.trim()
              : goal
                ? `Finish your plan for ${area?.name ?? "this goal"}`
                : !area
                  ? "Choose one area to work on"
                  : planState.stage === "in_progress"
                    ? `Finish your plan for ${area.name}`
                    : planState.stage === "done"
                      ? "Goal done. What’s next?"
                      : `Turn ${area.name} into one clear goal`}
          </h2>
          {planned ? (
            <dl className="next-action-facts">
              {when ? (<><dt>When</dt><dd>{when}</dd></>) : null}
              <dt>Goal check-in</dt>
              <dd>{checkInNow ? "Due now" : formatDate(checkInDue!)}</dd>
            </dl>
          ) : (
            <p className="next-action-sub">
              {goal || planState.stage === "in_progress"
                ? "Your answers are saved. Pick up where you left off."
                : planState.stage === "done"
                  ? "Set your next goal for this area, or choose a new area."
                  : "CLEAR is five short questions. It ends with one action, when you’ll do it, and a monthly goal check-in."}
            </p>
          )}
          <div className="next-action-cta">
            <Link href={action.href} className="btn btn-p">{action.label}</Link>
            {action.quiet ? <Link href={action.quiet.href} className="au-text-link">{action.quiet.label}</Link> : null}
          </div>
          {main?.otherActive.length ? (
            <p className="next-action-note">
              This is your main goal. You have {main.otherActive.length} other active goal
              {main.otherActive.length === 1 ? "" : "s"} — <Link href="/clear#other-goals">choose your main goal in My plan</Link>.
            </p>
          ) : null}
        </section>

        <div className="profile-side">
          {offerDetails ? <DetailsPrompt /> : null}
          <section className="profile-card" aria-labelledby="progress-h">
            <h2 id="progress-h">Your progress</h2>
            <ProfileSteps steps={steps} />
            {goalsDone ? (
              <p className="profile-won">
                <span aria-hidden="true">✓</span> {goalsDone} goal{goalsDone === 1 ? "" : "s"} completed
              </p>
            ) : null}
          </section>

          <section className="profile-card" aria-labelledby="learning-h">
            <h2 id="learning-h">{nextLesson ? "Continue learning" : "Academy"}</h2>
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
        </div>
      </div>

      <section className="profile-map" aria-labelledby="profile-map-h">
        <div className="au-chart">
          <LifeMap
            scores={scores}
            names={areas.map((a) => a.name)}
            labels={areas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
            highlightIndex={areaIdx === -1 ? null : areaIdx}
          />
        </div>
        <div className="profile-map-side">
          <h2 id="profile-map-h">Your whole-life audit</h2>
          <p className="au-small">
            Latest audit {formatDate(audit.completed_at)} · {audit.total_score ?? 0}/100. Scores are self-reported: how
            each area felt to you that day.{area ? " The highlighted area is the one you’re working on." : ""}
          </p>
          <p className="profile-strengths">
            <span>Strongest</span>
            {strongest.map((s) => `${s.name} ${s.score}`).join(" · ")}
          </p>
          <div className="profile-review">
            <span>Suggested next whole-life audit</span>
            <b>{auditDays <= 0 ? "Now — it’s been about three months" : `Around ${formatDate(auditDue)}`}</b>
            <em>
              About every three months is a useful rhythm. You can revisit earlier after a meaningful change.
            </em>
          </div>
          <div className="profile-links">
            <Link href="/audit/results" className="btn btn-g">View my full snapshot</Link>
            <Link href="/audit" className="au-text-link">{auditDays <= 0 ? "Retake the audit" : "Revisit the audit"}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
