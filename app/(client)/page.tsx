import Link from "next/link";
import {
  getLatestCompletedAudit,
  getRecentCompletedAudits,
  getAuditWithResponses,
  getLifeAreas,
} from "@/lib/actions/audit";
import { getPlanState } from "@/lib/actions/clear";
import { getCheckIns, getAllGoals } from "@/lib/actions/checkins";
import { getCurrentProfile } from "@/lib/session";
import { LifeMap } from "@/components/audit/LifeMap";
import { ScoreTrack } from "@/components/audit/ScoreTrack";
import { AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { daysUntil, formatDate, nextAuditDue, nextCheckInDue } from "@/lib/audit-schedule";

// My profile: their plan front and centre (goal, the road ahead, one clear
// action), the three dates that matter, and their life map.
export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  const firstName = profile?.full_name?.split(" ")[0];
  const audit = await getLatestCompletedAudit();

  if (!audit) {
    return (
      <div className="page au-page">
        <div className="eyebrow"><span className="eydot" /> My profile</div>
        <h1 className="au-latest-h">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
        <p className="lead">
          Start with the Aligned audit: ten honest questions about where your life stands right now. It takes about
          ten minutes, and gives you a snapshot and a clear place to start.
        </p>
        <Link href="/audit" className="btn btn-p">Begin my audit →</Link>
      </div>
    );
  }

  const [recent, { responses }, areas, planState] = await Promise.all([
    getRecentCompletedAudits(2),
    getAuditWithResponses(audit.id),
    getLifeAreas(),
    getPlanState(audit.id),
  ]);
  const { plan, goal, stage, step } = planState;

  const previous = recent[1];
  const delta = previous ? (audit.total_score ?? 0) - (previous.total_score ?? 0) : null;
  const scoreByArea = new Map(responses.map((r) => [r.life_area_id, r.satisfaction_score as number]));
  const scores = areas.map((a) => scoreByArea.get(a.id) ?? 0);

  const areaId = plan?.life_area_id ?? audit.focus_area_id ?? null;
  const areaIdx = areaId ? areas.findIndex((a) => a.id === areaId) : -1;
  const area = areaIdx !== -1 ? areas[areaIdx] : null;
  const auditScore = areaIdx !== -1 ? scores[areaIdx] : 0;
  const target = Math.min(10, plan?.step_up_target ?? auditScore + 1);

  const auditDue = nextAuditDue(audit.completed_at);
  const auditDays = daysUntil(auditDue);

  const activeGoal = stage === "done" && goal?.status === "active" ? goal : null;
  const checkIns = activeGoal ? await getCheckIns(activeGoal.id) : [];
  const lastCheckIn = checkIns[checkIns.length - 1];
  const nowScore = lastCheckIn?.area_score ?? auditScore;
  const checkInDue = activeGoal ? nextCheckInDue(lastCheckIn?.created_at ?? activeGoal.created_at ?? audit.completed_at) : null;
  const checkInDays = checkInDue ? daysUntil(checkInDue) : null;
  const when = activeGoal?.action_when?.trim() || activeGoal?.frequency?.trim() || null;

  const allGoals = await getAllGoals();

  const strongest = areas
    .map((a, i) => ({ name: AREA_SHORT_NAMES[a.sort_order] ?? a.name, score: scores[i] }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);

  // One clear action for the plan panel.
  const action = !area
    ? { href: "/clear", label: "Choose where to start →" }
    : stage === "none" || stage === "chosen"
      ? { href: "/clear", label: "Begin CLEAR →" }
      : stage === "in_progress"
        ? { href: "/clear", label: `Continue CLEAR — step ${step} of 5 →` }
        : !activeGoal
          ? { href: "/clear?new=1", label: "Set my next goal →" }
          : checkInDays !== null && checkInDays <= 0
            ? { href: "/clear/check-in", label: "Check in now →" }
            : { href: "/clear", label: "Open my plan" };

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> My profile</div>
      <h1 className="au-latest-h">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</h1>
      <p className="lead">
        {area
          ? activeGoal
            ? `You’re working on ${area.name}: from ${nowScore} towards ${target}.`
            : `Your starting point is ${area.name}, at ${auditScore}/10.`
          : "Choose one area from your snapshot to start working on."}
      </p>

      {auditDays <= 0 ? (
        <div className="profile-banner">
          <span>It&rsquo;s been around three months — your next audit is due.</span>
          <Link href="/audit/1" className="btn btn-p">Retake the audit →</Link>
        </div>
      ) : null}

      <section className="profile-plan" aria-label="Your plan">
        <div className="profile-plan-head">
          <div>
            <div className="eyebrow"><span className="eydot" /> Your plan{area ? ` · ${area.name}` : ""}</div>
            <h2>
              {activeGoal
                ? activeGoal.goal_title?.trim()
                : !area
                  ? "Choose where to start"
                  : stage === "in_progress"
                    ? `Finish your plan for ${area.name}`
                    : stage === "done"
                      ? "Goal done — what’s next?"
                      : `Turn ${area.name} into one clear goal`}
            </h2>
            {activeGoal ? (
              <dl className="profile-plan-facts">
                {when ? (<><dt>When</dt><dd>{when}</dd></>) : null}
                {activeGoal.success_criteria ? (<><dt>Success looks like</dt><dd>{activeGoal.success_criteria}</dd></>) : null}
              </dl>
            ) : (
              <p className="profile-plan-sub">
                {!area
                  ? "Pick one area from your snapshot. CLEAR then turns it into a goal you can act on this week."
                  : stage === "in_progress"
                    ? "Your answers are saved. Pick up where you left off."
                    : stage === "done"
                      ? "Set your next goal for this area, or wait for your next audit to choose a new one."
                      : "CLEAR is five short questions, about ten minutes. It ends with one action and a monthly check-in."}
              </p>
            )}
          </div>
          <div className="profile-plan-actions">
            <Link href={action.href} className="btn btn-p">{action.label}</Link>
            {activeGoal && action.href !== "/clear" ? <Link href="/clear" className="au-text-link">Open my plan</Link> : null}
            {activeGoal && checkInDays !== null && checkInDays > 0 ? (
              <Link href="/clear/check-in" className="au-text-link">Check in early</Link>
            ) : null}
          </div>
        </div>
        {area ? (
          activeGoal && checkInDue ? (
            <div className={`profile-next${checkInDays !== null && checkInDays <= 0 ? " due" : ""}`}>
              <span>Next check-in</span>
              <b>{checkInDays !== null && checkInDays <= 0 ? "Due now" : formatDate(checkInDue)}</b>
            </div>
          ) : (
            <div className="profile-track"><ScoreTrack score={auditScore} target={target} /></div>
          )
        ) : null}
      </section>

      {allGoals.length ? (
        <section className="profile-goals" aria-labelledby="profile-goals-h">
          <div className="profile-goals-head">
            <h2 id="profile-goals-h">My goals</h2>
            <span>One goal at a time — finish it, then set the next.</span>
          </div>
          <ul>
            {allGoals.slice(0, 5).map((g) => (
              <li key={g.id}>
                <span className={`past-status ${g.status}`}>
                  {g.status === "active" ? "Now" : g.status === "completed" ? "Done" : "Let go"}
                </span>
                <div>
                  <p>{g.goal_title?.trim()}</p>
                  <em>
                    {[g.focus_area, g.status === "active" && checkInDue ? `next check-in ${formatDate(checkInDue)}` : `set ${formatDate(g.created_at)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </em>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/clear" className="au-text-link">Open my plan</Link>
        </section>
      ) : null}

      <div className="profile-tiles">
        <div>
          <span>Latest audit</span>
          <b>{audit.total_score ?? 0}<small> / 100</small></b>
          <em>{formatDate(audit.completed_at)}{delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta}` : ""}</em>
        </div>
        <div className={checkInDays !== null && checkInDays <= 0 ? "due" : undefined}>
          <span>Next check-in</span>
          <b>{checkInDue ? (checkInDays! <= 0 ? "Now" : formatDate(checkInDue).replace(/ \d{4}$/, "")) : "—"}</b>
          <em>{checkInDue ? "Monthly, on your goal" : "Starts once your plan is set"}</em>
        </div>
        <div className={auditDays <= 0 ? "due" : undefined}>
          <span>Next audit</span>
          <b>{auditDays <= 0 ? "Now" : formatDate(auditDue).replace(/ \d{4}$/, "")}</b>
          <em>Every 3 months</em>
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
          <h2 id="profile-map-h">Your life map</h2>
          <p className="au-small">From your audit on {formatDate(audit.completed_at)}. The highlighted area is the one you&rsquo;re working on.</p>
          <p className="profile-strengths">
            <span>Strongest</span>
            {strongest.map((s) => `${s.name} ${s.score}`).join(" · ")}
          </p>
          <div className="profile-links">
            <Link href="/audit/results" className="btn btn-o">View my full snapshot</Link>
            <Link href="/summary" className="au-text-link">See my journey</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
