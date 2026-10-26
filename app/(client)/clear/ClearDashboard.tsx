import Link from "next/link";
import type { LifeArea } from "@/lib/actions/audit";
import type { ClearPlan, Goal } from "@/lib/actions/clear";
import type { CheckIn } from "@/lib/actions/checkins";
import { DID_IT_LABELS } from "@/lib/checkin-labels";
import { daysUntil, formatDate, nextCheckInDue } from "@/lib/audit-schedule";
import { ProgressPath, buildMilestones } from "@/components/audit/ProgressPath";
import { ReminderToggle } from "@/components/ui/ReminderToggle";
import { GoalActions } from "./GoalActions";
import { MainGoalButton } from "./MainGoalButton";
import { CLEAR_STEPS } from "./ClearIntro";
import { ClearLetters } from "./ClearLetters";
import { cleanReality, looksHardToVerify } from "@/lib/clear-text";

type ListedGoal = { id: string; goal_title: string; goal_type?: string; focus_area: string | null; status: string; created_at: string };

const NEXT_STEP_LABELS: Record<CheckIn["next_step"], string> = {
  keep: "Kept going",
  adjust: "Adjusted the action",
  done: "Marked the goal done",
};

const short = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

// My plan: why this matters and how they'll follow through. Where the area
// is and where they are in the rhythm first, then the goal itself; check-in
// history, CLEAR answers and other goals underneath.
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
  const statusChip = (status: string) =>
    status === "active" ? <span className="past-status active">Active</span>
    : status === "completed" ? <span className="past-status completed">✓ Done</span>
    : <span className="past-status abandoned">Let go</span>;
  const sortedOthers = [...otherGoals].sort((x, y) => ["active", "completed", "abandoned"].indexOf(x.status) - ["active", "completed", "abandoned"].indexOf(y.status));

  // The action as its own card only when the goal's wording doesn't already say it.
  const action = goal.action_text?.trim() ?? "";
  const actionInTitle = action && norm(goal.goal_title ?? "").includes(norm(action));
  const pillars = [goal.motivation_text?.trim(), plan.step_up_answer?.trim(), action && !actionInTitle, true, ifThen].filter(Boolean).length;

  // Where they are in the rhythm: audit, goal, practising, goal check-in, next audit.
  const rhythm: { label: string; sub: string; state: "done" | "now" | "next" }[] = [
    { label: "Audit", sub: `${short(auditDate)} · ${score}/10`, state: "done" },
    { label: "Goal set", sub: goal.created_at ? short(goal.created_at) : "", state: "done" },
    ...(closed
      ? [{ label: goal.status === "completed" ? "Goal done" : "Goal let go", sub: checkIns.length ? `${checkIns.length} goal check-in${checkIns.length === 1 ? "" : "s"}` : "", state: "done" as const }]
      : [
          {
            label: "Practising",
            sub: checkIns.length ? `${checkIns.length} goal check-in${checkIns.length === 1 ? "" : "s"} so far` : when ?? "Your action",
            state: "now" as const,
          },
          { label: "Goal check-in", sub: checkInNow ? "Due now" : short(checkInDue), state: checkInNow ? ("now" as const) : ("next" as const) },
        ]),
    { label: "Next audit", sub: auditDays <= 0 ? "Due now" : `around ${short(nextAuditDue)}`, state: "next" },
  ];

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> My plan · {area.name}</div>
      <div className={closed ? "pl-hero" : "pl-hero has-count"}>
        <div>
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
        </div>
        {!closed ? (
          <Link href="/clear/check-in" className={checkInNow ? "pl-count is-due" : "pl-count"}>
            <span className="pl-k">Next goal check-in</span>
            <b>{checkInNow ? "Due now" : checkInDays === 1 ? "Tomorrow" : `${checkInDays} days`}</b>
            <span>{checkInNow ? "Do it now →" : `${formatDate(checkInDue).replace(/ \d{4}$/, "")} · or check in early`}</span>
          </Link>
        ) : null}
      </div>

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

      <section className="pl-card" aria-labelledby="pl-where-h">
        <div className="pl-where-head">
          <h2 id="pl-where-h" className="pl-k">Where {area.name} is</h2>
          <span>
            Now <b>{latestScore}</b>
            {latestScore < target ? <> · next step <b className="pl-target">{target}</b></> : null}
          </span>
        </div>
        <div className="pl-track" role="img" aria-label={`${area.name} is at ${latestScore} out of 10, working towards ${target}`}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <div key={n} className={n <= latestScore ? "on" : n === target ? "goal" : undefined}>
              <span />
              <em>{n}</em>
            </div>
          ))}
        </div>
        <ol className="pl-rhythm" aria-label="Where you are in the rhythm">
          {rhythm.map((r) => (
            <li key={r.label} className={`is-${r.state}`}>
              <i aria-hidden="true">{r.state === "done" ? "✓" : ""}</i>
              <b>{r.label}</b>
              <span>{r.sub}</span>
            </li>
          ))}
        </ol>
        <p className="plan-small">
          Self-reported. {checkIns.length ? `From your last goal check-in, ${formatDate(lastCheckIn.created_at)}.` : `From your audit, ${formatDate(auditDate)}.`}{" "}
          Circumstances move scores too, so your notes and actions count as evidence alongside the number. Goal check-ins
          are monthly by default, and you can check in sooner; a goal can finish earlier or carry on longer.
        </p>
        {remindersOn !== null && !closed ? <ReminderToggle initial={remindersOn} /> : null}
      </section>

      <section className="pl-goal" aria-labelledby="plan-goal-h">
        <div className="eyebrow">
          <span className="eydot" /> {closed ? (goal.status === "completed" ? "Goal done" : "Goal let go") : isMain ? "Your main goal" : "Your goal"}
        </div>
        <h2 id="plan-goal-h">{goal.goal_title?.trim()}</h2>
        {when ? (
          <p className="pl-when">
            <span className="pl-chip">{when}</span>
            {!closed ? <span>Each time you do it is practice. It doesn&rsquo;t close the goal on its own.</span> : null}
          </p>
        ) : null}

        <div className="pl-pillars">
          {goal.motivation_text?.trim() ? (
            <div className={pillars % 2 ? "pl-pillar is-wide" : "pl-pillar"}>
              <h3 className="pl-k">Why it matters</h3>
              <p className="pl-quote">&ldquo;{goal.motivation_text.trim()}&rdquo;</p>
            </div>
          ) : null}
          {plan.step_up_answer?.trim() ? (
            <div className="pl-pillar">
              <h3 className="pl-k">What a {target} looks like</h3>
              <p>{plan.step_up_answer.trim()}</p>
            </div>
          ) : null}
          {action && !actionInTitle ? (
            <div className="pl-pillar">
              <h3 className="pl-k">The action</h3>
              <p>{action}</p>
            </div>
          ) : null}
          <div className="pl-pillar">
            <h3 className="pl-k">Done when</h3>
            <p>{goal.success_criteria?.trim() || "—"}</p>
            {vague && !closed ? (
              <p className="plan-hint">
                Could someone else tell this had happened? If not, add one thing you&rsquo;d see or count.{" "}
                <Link href="/clear?edit=5">Clarify it</Link> — your words stay as they are until you change them.
              </p>
            ) : null}
          </div>
          {ifThen ? (
            <div className="pl-pillar">
              <h3 className="pl-k">If it gets hard</h3>
              <p>{ifThen}</p>
            </div>
          ) : null}
        </div>

        {closed ? (
          <div className="pl-cta">
            <Link href="/clear?new=1" className="btn btn-p">Set my next goal →</Link>
          </div>
        ) : (
          <div className="pl-cta">
            <Link href="/clear/check-in" className="btn btn-p">{checkInNow ? "Do my goal check-in →" : "Check in early"}</Link>
            <Link href="/clear?edit=4" className="au-text-link">Adjust the action</Link>
            <GoalActions goalId={goal.id} />
          </div>
        )}
      </section>

      {checkIns.length ? (
        <section className="pl-card" aria-labelledby="pl-going-h">
          <h2 id="pl-going-h" className="pl-h">How it&rsquo;s going</h2>
          <div className="au-chart clear-progress">
            <ProgressPath milestones={milestones} target={target} />
            <p className="au-chart-caption">
              Gold is how {area.name} has felt at each goal check-in (self-reported). The dotted line runs to your suggested next whole-life audit.
            </p>
          </div>
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
        </section>
      ) : null}

      <section className="pl-section" aria-labelledby="pl-clear-h">
        <div className="pl-section-head">
          <h2 id="pl-clear-h" className="pl-h">Your CLEAR answers</h2>
          <span>As you wrote them · tap a letter</span>
        </div>
        <ClearLetters items={CLEAR_STEPS.map((s, i) => ({ letter: s.letter, name: s.name, text: answers[i] }))} />
        <p className="pl-edit"><Link href="/clear?edit=1" className="au-text-link">Review or edit my answers</Link></p>
      </section>

      {otherGoals.length ? (
        <section className="pl-section" id="other-goals" aria-labelledby="other-goals-h">
          <h2 id="other-goals-h" className="pl-h">Other goals</h2>
          <ul className="pl-others">
            {sortedOthers.map((g) => (
              <li key={g.id} className={`is-${g.status}`}>
                {statusChip(g.status)}
                <p>{g.goal_title?.trim()}</p>
                <span>{[g.focus_area, `set ${formatDate(g.created_at)}`].filter(Boolean).join(" · ")}</span>
                {g.status === "active" ? <MainGoalButton goalId={g.id} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
