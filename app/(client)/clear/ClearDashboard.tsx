import Link from "next/link";
import type { LifeArea } from "@/lib/actions/audit";
import type { ClearPlan, Goal } from "@/lib/actions/clear";
import type { CheckIn } from "@/lib/actions/checkins";
import { DID_IT_LABELS } from "@/lib/checkin-labels";
import { daysUntil, formatDate, nextCheckInDue } from "@/lib/audit-schedule";
import { ProgressPath, buildMilestones } from "@/components/audit/ProgressPath";
import { ScoreTrack } from "@/components/audit/ScoreTrack";
import { GoalActions } from "./GoalActions";
import { CLEAR_STEPS } from "./ClearIntro";
import { cleanReality } from "@/lib/clear-text";

type PastGoal = { id: string; goal_title: string; focus_area: string | null; status: string; created_at: string };

const NEXT_STEP_LABELS: Record<CheckIn["next_step"], string> = {
  keep: "Kept going",
  adjust: "Adjusted the action",
  done: "Marked done",
};


// My plan: the goal, how it's going (progress line + monthly check-ins), what
// happens next, their CLEAR answers, and past goals.
export function ClearDashboard({
  area,
  score,
  plan,
  goal,
  nextAuditDue,
  auditDate,
  checkIns,
  pastGoals,
}: {
  area: LifeArea;
  score: number;
  plan: ClearPlan;
  goal: Goal;
  nextAuditDue: Date;
  auditDate: string;
  checkIns: CheckIn[];
  pastGoals: PastGoal[];
}) {
  const target = Math.min(10, plan.step_up_target ?? score + 1);
  const latestScore = checkIns.length ? checkIns[checkIns.length - 1].area_score : score;
  const closed = goal.status !== "active";
  const ifThen = plan.if_obstacle?.trim() && plan.if_response?.trim() ? `If ${plan.if_obstacle.trim()}, then I’ll ${plan.if_response.trim()}.` : null;
  const when = goal.action_when?.trim() || goal.frequency?.trim() || null;

  const lastCheckIn = checkIns[checkIns.length - 1];
  const checkInDue = nextCheckInDue(lastCheckIn?.created_at ?? goal.created_at ?? auditDate);
  const checkInDays = daysUntil(checkInDue);
  const auditDays = daysUntil(nextAuditDue);
  const milestones = buildMilestones({ auditDate, auditScore: score, checkIns, nextAuditDue });

  const answers = [
    cleanReality(plan.current_reality),
    [plan.life_vision, plan.step_up_answer ? `Next step: ${plan.step_up_answer}` : null].filter(Boolean).join("\n"),
    [plan.blocks?.length ? plan.blocks.join(", ") : null, plan.emotional_blocks].filter(Boolean).join("\n"),
    goal.goal_title,
    [goal.success_criteria, ifThen].filter(Boolean).join("\n"),
  ];

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> My plan</div>
      <h1 className="au-latest-h">
        {closed && goal.status === "completed"
          ? `${area.name}: goal done.`
          : latestScore >= target
            ? `${area.name}: you’ve reached ${target}.`
            : `${area.name}: from ${latestScore} towards ${target}.`}
      </h1>
      <p className="lead">
        {closed
          ? "Nice work. Set your next goal for this area, or wait for your next audit to choose a new one."
          : "One action, done consistently, is how a score moves. Here’s your plan and how it’s going."}
      </p>

      <div className="clear-dash">
        <section className="clear-goal" aria-label="Your goal">
          <div className="eyebrow">
            <span className="eydot" /> {closed ? (goal.status === "completed" ? "Goal done" : "Goal let go") : "Your goal"}
          </div>
          <h2>{goal.goal_title?.trim()}</h2>
          {goal.action_text ? (
            <div className="clear-goal-row">
              <span>The one action</span>
              <p>{goal.action_text}</p>
            </div>
          ) : null}
          <div className="clear-goal-row">
            <span>When</span>
            <p className="clear-freq">{when}</p>
          </div>
          <div className="clear-goal-row">
            <span>Success looks like</span>
            <p>{goal.success_criteria}</p>
          </div>
          {ifThen ? (
            <div className="clear-goal-row">
              <span>If it gets hard</span>
              <p>{ifThen}</p>
            </div>
          ) : null}
          {goal.motivation_text ? (
            <blockquote className="au-quote">
              <cite>Why it matters</cite>
              <p>&ldquo;{goal.motivation_text}&rdquo;</p>
            </blockquote>
          ) : null}
          {closed ? (
            <div className="goal-actions">
              <Link href="/clear?new=1" className="btn btn-p">Set my next goal →</Link>
            </div>
          ) : (
            <GoalActions goalId={goal.id} />
          )}
        </section>

        <div className="clear-side">
          {closed ? null : (
            <section className={`au-sum-card${checkInDays <= 0 ? " due" : ""}`} aria-label="Monthly check-in">
              <h3>{checkInDays <= 0 ? "Your monthly check-in is due" : "Next check-in"}</h3>
              <p className="au-latest-big">{checkInDays <= 0 ? "Now" : formatDate(checkInDue)}</p>
              <p>Two minutes: did you do it, where the area is now, and what next.</p>
              <div className="goal-actions" style={{ borderTop: 0, paddingTop: 0 }}>
                <Link href="/clear/check-in" className={checkInDays <= 0 ? "btn btn-p" : "btn btn-o"}>
                  {checkInDays <= 0 ? "Check in now" : "Check in early"}
                </Link>
              </div>
            </section>
          )}
          <section className="au-sum-card" aria-label="Where this area is">
            <h3>Where this area is</h3>
            <ScoreTrack score={latestScore} target={target} />
          </section>
          <section className="au-sum-card" aria-label="What happens now">
            <h3>What happens now</h3>
            <ol className="clear-now">
              <li>
                <b>Do the action</b> — {when ? when.charAt(0).toLowerCase() + when.slice(1) : "as planned"}.
              </li>
              <li>
                <b>Check in monthly</b> — next {checkInDays <= 0 ? "now" : formatDate(checkInDue)}.
              </li>
              <li>
                <b>Retake the audit</b> {auditDays <= 0 ? "now" : `around ${formatDate(nextAuditDue)}`} to see the whole picture.
              </li>
            </ol>
          </section>
        </div>
      </div>

      <section className="clear-review" aria-labelledby="clear-progress-h">
        <h2 id="clear-progress-h" className="sec-head">How it&rsquo;s going</h2>
        <div className="au-chart clear-progress">
          <ProgressPath milestones={milestones} target={target} />
          <p className="au-chart-caption">
            {checkIns.length === 0
              ? `Your quarter, mapped out. Each monthly check-in adds a point, so you can see whether ${area.name} is moving.`
              : `Gold is how ${area.name} has moved. The dotted line is the road ahead to your next audit.`}
          </p>
        </div>
        {checkIns.length ? (
          <ol className="checkin-list">
            {[...checkIns].reverse().map((c) => (
              <li key={c.id}>
                <div className="checkin-head">
                  <b>{formatDate(c.created_at)}</b>
                  <span>{DID_IT_LABELS[c.did_it]} · {c.area_score}/10 · {NEXT_STEP_LABELS[c.next_step]}</span>
                </div>
                {c.helped ? <p><span>Helped:</span> {c.helped}</p> : null}
                {c.got_in_way ? <p><span>Got in the way:</span> {c.got_in_way}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section className="clear-review" aria-labelledby="clear-review-h">
        <h2 id="clear-review-h" className="sec-head">Your CLEAR answers</h2>
        <ol className="clear-letters done">
          {CLEAR_STEPS.map((s, i) => (
            <li key={s.letter}>
              <span className="clear-letter">{s.letter}</span>
              <div>
                <h3>{s.name}</h3>
                <p>{answers[i] || "—"}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="au-latest-actions" style={{ marginTop: "1rem" }}>
          <Link href="/clear?edit=1" className="btn btn-o">Review or edit my answers</Link>
        </div>
      </section>

      {pastGoals.length ? (
        <section className="clear-review" aria-labelledby="past-goals-h">
          <h2 id="past-goals-h" className="sec-head">Past goals</h2>
          <ul className="past-goals">
            {pastGoals.map((g) => (
              <li key={g.id}>
                <span className={`past-status ${g.status}`}>
                  {g.status === "completed" ? "Done" : g.status === "abandoned" ? "Let go" : "Active"}
                </span>
                <div>
                  <p>{g.goal_title?.trim()}</p>
                  <span>{[g.focus_area, formatDate(g.created_at)].filter(Boolean).join(" · ")}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
