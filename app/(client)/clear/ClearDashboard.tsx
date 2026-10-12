import Link from "next/link";
import type { LifeArea } from "@/lib/actions/audit";
import type { ClearPlan, Goal } from "@/lib/actions/clear";
import { daysUntil, formatDate } from "@/lib/audit-schedule";
import { GoalActions } from "../goals/GoalActions";
import { CLEAR_STEPS } from "./ClearIntro";
import { ScoreTrack } from "@/components/audit/ScoreTrack";

// After CLEAR: their plan at a glance — where they are, the one thing they're
// doing, what success looks like, and what happens next.
export function ClearDashboard({
  area,
  score,
  plan,
  goal,
  nextAuditDue,
}: {
  area: LifeArea;
  score: number;
  plan: ClearPlan;
  goal: Goal;
  nextAuditDue: Date;
}) {
  const target = Math.min(10, plan.step_up_target ?? score + 1);
  const days = daysUntil(nextAuditDue);
  const ifThen = plan.if_obstacle?.trim() && plan.if_response?.trim() ? `If ${plan.if_obstacle.trim()}, then I’ll ${plan.if_response.trim()}.` : null;
  const when = goal.action_when?.trim() || goal.frequency?.trim() || null;
  const answers = [
    plan.current_reality,
    [plan.life_vision, plan.step_up_answer ? `Next step: ${plan.step_up_answer}` : null].filter(Boolean).join("\n"),
    [plan.blocks?.length ? plan.blocks.join(", ") : null, plan.emotional_blocks].filter(Boolean).join("\n"),
    goal.goal_title,
    [goal.success_criteria, ifThen].filter(Boolean).join("\n"),
  ];
  const closed = goal.status !== "active";

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> Your CLEAR plan</div>
      <h1 className="au-latest-h">
        {area.name}: from {score} towards {target}.
      </h1>
      <p className="lead">One action, done consistently, is how a score moves. Here&rsquo;s your plan.</p>

      <div className="clear-dash">
        <section className="clear-goal" aria-label="Your goal">
          <div className="eyebrow"><span className="eydot" /> {closed ? (goal.status === "completed" ? "Goal done" : "Goal let go") : "Your goal"}</div>
          <h2>{goal.goal_title}</h2>
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
          {closed ? null : <GoalActions goalId={goal.id} />}
        </section>

        <div className="clear-side">
          <section className="au-sum-card" aria-label="Progress">
            <h3>Where this area is</h3>
            <ScoreTrack score={score} target={target} />
          </section>

          <section className="au-sum-card" aria-label="What happens now">
            <h3>What happens now</h3>
            <ol className="clear-now">
              <li>
                <b>Do the action</b> — {when ? when.charAt(0).toLowerCase() + when.slice(1) : "as planned"}.
              </li>
              <li>
                <b>Notice what changes.</b> Small shifts count.
              </li>
              <li>
                <b>Retake the audit</b> {days <= 0 ? "now" : `around ${formatDate(nextAuditDue)}`} to see if {area.name} has moved.
              </li>
            </ol>
          </section>
        </div>
      </div>

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
      </section>

      <div className="au-latest-actions">
        <Link href="/clear?edit=1" className="btn btn-o">Review or edit my answers</Link>
        <Link href="/" className="au-text-link">Go to my profile</Link>
      </div>
    </div>
  );
}
