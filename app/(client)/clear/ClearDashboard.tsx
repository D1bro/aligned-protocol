import Link from "next/link";
import type { LifeArea } from "@/lib/actions/audit";
import type { ClearPlan, Goal } from "@/lib/actions/clear";
import type { CheckIn } from "@/lib/actions/checkins";
import { DID_IT_LABELS } from "@/lib/checkin-labels";
import { daysUntil, formatDate, nextCheckInDue } from "@/lib/audit-schedule";
import { ProgressPath, buildMilestones } from "@/components/audit/ProgressPath";
import { ScoreTrack } from "@/components/audit/ScoreTrack";
import { ReminderToggle } from "@/components/ui/ReminderToggle";
import { GoalActions } from "./GoalActions";
import { MainGoalButton } from "./MainGoalButton";
import { CLEAR_STEPS } from "./ClearIntro";
import { cleanReality, looksHardToVerify } from "@/lib/clear-text";

type ListedGoal = { id: string; goal_title: string; goal_type?: string; focus_area: string | null; status: string; created_at: string };

const NEXT_STEP_LABELS: Record<CheckIn["next_step"], string> = {
  keep: "Kept going",
  adjust: "Adjusted the action",
  done: "Marked the goal done",
};

// The four parts of the Aligned rhythm, named the same way everywhere.
export const RHYTHM = [
  { term: "Audit", q: "How does my life feel across all ten areas?" },
  { term: "Goal", q: "What am I choosing to change?" },
  { term: "Action", q: "What will I actually do?" },
  { term: "Goal check-in", q: "What happened, and what needs adjusting?" },
];

// My plan: why this matters and how they'll follow through. The working plan
// first; review history, CLEAR answers and other goals underneath.
export function ClearDashboard({
  area,
  score,
  plan,
  goal,
  nextAuditDue,
  auditDate,
  checkIns,
  otherGoals,
  isMain,
  newerAudit,
  remindersOn,
}: {
  area: LifeArea;
  score: number;
  plan: ClearPlan;
  goal: Goal;
  nextAuditDue: Date;
  auditDate: string;
  checkIns: CheckIn[];
  otherGoals: ListedGoal[];
  isMain: boolean;
  // Date of an audit taken after this goal was planned, with no plan yet.
  newerAudit: string | null;
  // null when reminder emails aren't set up (the switch stays hidden).
  remindersOn: boolean | null;
}) {
  const target = Math.min(10, plan.step_up_target ?? score + 1);
  const latestScore = checkIns.length ? checkIns[checkIns.length - 1].area_score : score;
  const closed = goal.status !== "active";
  const ifThen =
    plan.if_obstacle?.trim() && plan.if_response?.trim() ? `If ${plan.if_obstacle.trim()}, then I’ll ${plan.if_response.trim()}.` : null;
  const when = goal.action_when?.trim() || goal.frequency?.trim() || null;

  const lastCheckIn = checkIns[checkIns.length - 1];
  const checkInDue = nextCheckInDue(lastCheckIn?.created_at ?? goal.created_at ?? auditDate);
  const checkInDays = daysUntil(checkInDue);
  const checkInNow = checkInDays <= 0;
  const auditDays = daysUntil(nextAuditDue);
  const milestones = buildMilestones({ auditDate, auditScore: score, checkIns, nextAuditDue });
  const vague = looksHardToVerify(goal.success_criteria);

  const answers = [
    cleanReality(plan.current_reality),
    [plan.life_vision, plan.step_up_answer ? `Next step: ${plan.step_up_answer}` : null].filter(Boolean).join("\n"),
    [plan.blocks?.length ? plan.blocks.join(", ") : null, plan.emotional_blocks, plan.tried_before ? `Tried before: ${plan.tried_before}` : null]
      .filter(Boolean)
      .join("\n"),
    [goal.goal_title, goal.action_text ? `Action: ${goal.action_text}` : null, goal.motivation_text ? `Why: ${goal.motivation_text}` : null]
      .filter(Boolean)
      .join("\n"),
    [goal.success_criteria, ifThen].filter(Boolean).join("\n"),
  ];

  const otherActive = otherGoals.filter((g) => g.status === "active");
  const done = otherGoals.filter((g) => g.status === "completed");
  const letGo = otherGoals.filter((g) => g.status === "abandoned");

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> My plan · {area.name}</div>
      <h1 className="au-latest-h">
        {closed && goal.status === "completed"
          ? `${area.name}: goal done.`
          : closed
            ? `${area.name}: goal let go.`
            : `${area.name}: from ${latestScore} towards ${target}.`}
      </h1>
      <p className="lead">
        {closed
          ? "Set your next goal for this area, or choose a new area. What you did and learnt stays in My journey."
          : "One action, practised and reviewed, gives you something concrete to work with."}
      </p>

      {!closed && isMain && otherActive.length ? (
        <p className="plan-note">
          This is your <b>main goal</b> — the one My profile shows. You have {otherActive.length} other active goal
          {otherActive.length === 1 ? "" : "s"}; <a href="#other-goals">choose your main goal below</a>.
        </p>
      ) : null}
      {!closed && newerAudit ? (
        <p className="plan-note">
          You took an audit on {formatDate(newerAudit)}, after this plan was made. Keep working on this goal, or{" "}
          <Link href="/clear?latest=1">make a plan from your latest audit</Link>. A new plan becomes your main goal;
          this one stays active, and you can switch back at any time.
        </p>
      ) : null}

      <div className="plan-grid">
        <section className="plan-card" aria-labelledby="plan-goal-h">
          <div className="eyebrow">
            <span className="eydot" /> {closed ? (goal.status === "completed" ? "Goal done" : "Goal let go") : isMain ? "Your main goal" : "Your goal"}
          </div>
          <h2 id="plan-goal-h">{goal.goal_title?.trim()}</h2>
          <dl className="plan-rows">
            {plan.step_up_answer?.trim() ? (
              <div>
                <dt>The change</dt>
                <dd>
                  <span className="plan-sub">What a {target} looks like</span>
                  {plan.step_up_answer.trim()}
                </dd>
              </div>
            ) : null}
            {goal.motivation_text?.trim() ? (
              <div>
                <dt>Why it matters</dt>
                <dd>{goal.motivation_text.trim()}</dd>
              </div>
            ) : null}
            {goal.action_text?.trim() ? (
              <div>
                <dt>The action</dt>
                <dd>
                  {goal.action_text.trim()}
                  <span className="plan-hint">Each time you do it is practice. It doesn&rsquo;t close the goal on its own.</span>
                </dd>
              </div>
            ) : null}
            {when ? (
              <div>
                <dt>When</dt>
                <dd>{when}</dd>
              </div>
            ) : null}
            <div>
              <dt>The goal is done when</dt>
              <dd>
                {goal.success_criteria?.trim()}
                {vague && !closed ? (
                  <span className="plan-hint">
                    Could someone else tell this had happened? If not, add one thing you&rsquo;d see or count.{" "}
                    <Link href="/clear?edit=5">Clarify it</Link> — your words stay as they are until you change them.
                  </span>
                ) : null}
              </dd>
            </div>
            {ifThen ? (
              <div>
                <dt>If it gets hard</dt>
                <dd>{ifThen}</dd>
              </div>
            ) : null}
            {!closed ? (
              <div>
                <dt>Next goal check-in</dt>
                <dd>{checkInNow ? "Due now" : formatDate(checkInDue)}</dd>
              </div>
            ) : null}
          </dl>

          {closed ? (
            <div className="goal-actions">
              <Link href="/clear?new=1" className="btn btn-p">Set my next goal →</Link>
            </div>
          ) : (
            <>
              <div className="plan-cta">
                <Link href="/clear/check-in" className={checkInNow ? "btn btn-p" : "btn btn-o"}>
                  {checkInNow ? "Do my goal check-in →" : "Check in early"}
                </Link>
                <Link href="/clear?edit=4" className="au-text-link">Adjust the action</Link>
              </div>
              <GoalActions goalId={goal.id} />
            </>
          )}
        </section>

        <div className="clear-side">
          <section className="au-sum-card" aria-label="Where this area is">
            <h3>Where {area.name} is</h3>
            <ScoreTrack score={latestScore} target={target} />
            <p className="plan-small">
              Self-reported. {checkIns.length ? `From your last goal check-in, ${formatDate(lastCheckIn.created_at)}.` : `From your audit, ${formatDate(auditDate)}.`}{" "}
              Circumstances move scores too, so your notes and actions count as evidence alongside the number.
            </p>
          </section>
          <section className="au-sum-card" aria-label="How it fits together">
            <h3>How it fits together</h3>
            <dl className="plan-rhythm">
              {RHYTHM.map((r) => (
                <div key={r.term}>
                  <dt>{r.term}</dt>
                  <dd>{r.q}</dd>
                </div>
              ))}
            </dl>
            <p className="plan-small">
              Goal check-ins are monthly by default, and you can check in sooner. A goal can finish earlier or carry on
              longer. Suggested next whole-life audit:{" "}
              {auditDays <= 0 ? "now" : `around ${formatDate(nextAuditDue)}`}.
            </p>
            {remindersOn !== null && !closed ? <ReminderToggle initial={remindersOn} /> : null}
          </section>
        </div>
      </div>

      <details className="plan-more" open={checkIns.length > 0}>
        <summary>
          How it&rsquo;s going <span>{checkIns.length ? `${checkIns.length} goal check-in${checkIns.length === 1 ? "" : "s"}` : "No goal check-ins yet"}</span>
        </summary>
        <div className="au-chart clear-progress">
          <ProgressPath milestones={milestones} target={target} />
          <p className="au-chart-caption">
            {checkIns.length === 0
              ? `Each goal check-in adds a point (self-reported), so you can see how ${area.name} feels over time. The last point is your suggested next whole-life audit.`
              : `Gold is how ${area.name} has felt at each goal check-in (self-reported). The dotted line runs to your suggested next whole-life audit.`}
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
        ) : (
          <p className="au-small">Your first goal check-in records what you did, what helped and what got in the way.</p>
        )}
      </details>

      <details className="plan-more">
        <summary>Your CLEAR answers <span>As you wrote them</span></summary>
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
          <Link href="/clear?edit=1" className="btn btn-g">Review or edit my answers</Link>
        </div>
      </details>

      {otherGoals.length ? (
        <section className="clear-review" id="other-goals" aria-labelledby="other-goals-h">
          <h2 id="other-goals-h" className="sec-head">Other goals</h2>
          {otherActive.length ? (
            <>
              <h3 className="goal-group">Also active</h3>
              <ul className="past-goals">
                {otherActive.map((g) => (
                  <li key={g.id}>
                    <span className="past-status active">Active</span>
                    <div>
                      <p>{g.goal_title?.trim()}</p>
                      <span>{[g.focus_area, `set ${formatDate(g.created_at)}`].filter(Boolean).join(" · ")}</span>
                      <MainGoalButton goalId={g.id} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {done.length ? (
            <>
              <h3 className="goal-group">Completed</h3>
              <ul className="past-goals">
                {done.map((g) => (
                  <li key={g.id}>
                    <span className="past-status completed">✓ Done</span>
                    <div>
                      <p>{g.goal_title?.trim()}</p>
                      <span>{[g.focus_area, `set ${formatDate(g.created_at)}`].filter(Boolean).join(" · ")}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {letGo.length ? (
            <>
              <h3 className="goal-group">Let go</h3>
              <ul className="past-goals">
                {letGo.map((g) => (
                  <li key={g.id}>
                    <span className="past-status abandoned">Let go</span>
                    <div>
                      <p>{g.goal_title?.trim()}</p>
                      <span>{[g.focus_area, `set ${formatDate(g.created_at)}`].filter(Boolean).join(" · ")}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
