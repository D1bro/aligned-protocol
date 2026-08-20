"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveClearReflection,
  createGoalFromClear,
  updateGoalCore,
  saveGoalRoadmap,
} from "@/lib/actions/clear";
import type { ClearPlan, Goal } from "@/lib/actions/clear";
import type { LifeArea } from "@/lib/actions/audit";

const STEP_LABELS = ["Current Reality", "Life Vision", "Emotional Blocks", "Aligned Goal", "Roadmap & Review"];
const TOTAL_STEPS = 5;

// Figures out where to resume based on what's actually saved, same idea as
// the audit's "land on the first unanswered area" behaviour.
function computeInitialStep(plan: ClearPlan, goal: Goal | null): number {
  if (!plan.current_reality) return 1;
  if (!plan.life_vision) return 2;
  if (!plan.emotional_blocks) return 3;
  if (!goal) return 4;
  if (!goal.frequency || !goal.success_criteria) return 5;
  return 6; // everything already saved — show the finished summary
}

export function ClearWizard({
  area,
  plan,
  goal: initialGoal,
}: {
  area: LifeArea;
  plan: ClearPlan;
  goal: Goal | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(() => computeInitialStep(plan, initialGoal));
  const [goal, setGoal] = useState(initialGoal);
  const [currentReality, setCurrentReality] = useState(plan.current_reality ?? "");
  const [lifeVision, setLifeVision] = useState(plan.life_vision ?? "");
  const [emotionalBlocks, setEmotionalBlocks] = useState(plan.emotional_blocks ?? "");
  const [goalTitle, setGoalTitle] = useState(initialGoal?.goal_title ?? "");
  const [actionText, setActionText] = useState(initialGoal?.action_text ?? "");
  const [motivationText, setMotivationText] = useState(initialGoal?.motivation_text ?? "");
  const [frequency, setFrequency] = useState(initialGoal?.frequency ?? "");
  const [successCriteria, setSuccessCriteria] = useState(initialGoal?.success_criteria ?? "");
  const [pending, startTransition] = useTransition();

  const canContinue = step === 4 ? goalTitle.trim().length > 0 : true;
  const pct = Math.round((Math.min(step, TOTAL_STEPS) / TOTAL_STEPS) * 100);

  function next() {
    if (!canContinue) return;
    startTransition(async () => {
      if (step === 1) {
        await saveClearReflection(plan.id, { current_reality: currentReality });
      } else if (step === 2) {
        await saveClearReflection(plan.id, { life_vision: lifeVision });
      } else if (step === 3) {
        await saveClearReflection(plan.id, { emotional_blocks: emotionalBlocks });
      } else if (step === 4) {
        if (goal) {
          await updateGoalCore(goal.id, { goalTitle, actionText, motivationText });
        } else {
          const created = await createGoalFromClear({
            clearPlanId: plan.id,
            focusArea: area.name,
            goalTitle,
            actionText,
            motivationText,
          });
          setGoal(created);
        }
      } else if (step === 5) {
        if (goal) await saveGoalRoadmap(goal.id, { frequency, successCriteria });
      }
      setStep((s) => s + 1);
    });
  }

  function back() {
    if (step > 1) setStep(step - 1);
  }

  if (step === 6) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
        <div className="eyebrow"><span className="eydot" /> CLEAR complete</div>
        <h1>Your plan for {area.name} is set.</h1>
        <p className="lead" style={{ margin: "0 auto 1.5rem" }}>
          You&apos;ve turned the audit into an actual plan. This is now your active goal — it&apos;ll show up
          on your dashboard and under My Goals.
        </p>
        <div className="card card-pop" style={{ maxWidth: 480, margin: "0 auto", textAlign: "left" }}>
          <div className="hbox">
            <div className="hbox-l">Goal</div>
            <div className="hbox-v">{goalTitle}</div>
          </div>
          {actionText ? (
            <div className="hbox">
              <div className="hbox-l">The one action</div>
              <div className="hbox-v">{actionText}</div>
            </div>
          ) : null}
          {frequency ? (
            <div className="hbox">
              <div className="hbox-l">Frequency</div>
              <div className="hbox-v">{frequency}</div>
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: "2rem" }}>
          <button className="btn btn-p" onClick={() => router.push("/")}>Go to my dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        {step > 1 ? (
          <button className="tb-back" onClick={back} disabled={pending}>← Back</button>
        ) : (
          <span />
        )}
        <span className="tb-label">{STEP_LABELS[step - 1]} — Step {step} of {TOTAL_STEPS}</span>
      </div>
      <div className="progbar"><div className="progfill" style={{ width: `${pct}%` }} /></div>

      <div className="page">
        <div className="area-icon" style={{ width: 44, height: 44, fontSize: 18, marginBottom: "1rem" }}>
          {area.icon}
        </div>
        <div className="eyebrow"><span className="eydot" /> CLEAR — {area.name}</div>

        {step === 1 && (
          <>
            <h1>Where are things really at, right now?</h1>
            <p className="lead">Be honest, not diplomatic — this is just for you.</p>
            <textarea
              rows={6}
              value={currentReality}
              onChange={(e) => setCurrentReality(e.target.value)}
              placeholder="Describe where this area actually stands today…"
            />
          </>
        )}

        {step === 2 && (
          <>
            <h1>If this were fully aligned, what would that look like?</h1>
            <p className="lead">Paint the picture — specific, not vague.</p>
            <textarea
              rows={6}
              value={lifeVision}
              onChange={(e) => setLifeVision(e.target.value)}
              placeholder="Describe what full alignment in this area would actually look like…"
            />
          </>
        )}

        {step === 3 && (
          <>
            <h1>What&apos;s the honest reason this hasn&apos;t changed already?</h1>
            <p className="lead">Not the practical excuse — the emotional one underneath it.</p>
            <textarea
              rows={6}
              value={emotionalBlocks}
              onChange={(e) => setEmotionalBlocks(e.target.value)}
              placeholder="What's actually been in the way?"
            />
          </>
        )}

        {step === 4 && (
          <>
            <h1>What&apos;s the one goal that moves this forward?</h1>
            <p className="lead">One goal, not five. Small and real beats big and vague.</p>
            <label className="lbl" htmlFor="goal-title">Goal</label>
            <input
              id="goal-title"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g. Build a consistent morning routine"
            />
            <label className="lbl" htmlFor="goal-action">The one action</label>
            <textarea
              id="goal-action"
              rows={3}
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder="What will you actually do?"
            />
            <label className="lbl" htmlFor="goal-why">Why this matters</label>
            <textarea
              id="goal-why"
              rows={3}
              value={motivationText}
              onChange={(e) => setMotivationText(e.target.value)}
              placeholder="Why does this matter enough to actually follow through?"
            />
          </>
        )}

        {step === 5 && (
          <>
            <h1>How often, and how will you know it&apos;s working?</h1>
            <p className="lead">This is what turns a goal into a habit.</p>
            <label className="lbl" htmlFor="goal-freq">Frequency</label>
            <input
              id="goal-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g. Daily, most weekdays, 3x a week"
            />
            <label className="lbl" htmlFor="goal-success">Success looks like</label>
            <textarea
              id="goal-success"
              rows={3}
              value={successCriteria}
              onChange={(e) => setSuccessCriteria(e.target.value)}
              placeholder="How will you know this is actually working?"
            />
          </>
        )}
      </div>

      <div className="foot-nav">
        <span className="tb-label">{canContinue ? "Saved automatically" : "Add a goal to continue"}</span>
        <button className="btn btn-p" disabled={pending || !canContinue} onClick={next}>
          {pending ? "Saving…" : step === TOTAL_STEPS ? "Finish" : "Continue"}
        </button>
      </div>
    </>
  );
}
