"use client";

import { useRef, useState } from "react";
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

const filled = (v: string | null | undefined) => !!v?.trim();

// Figures out where to resume based on what's actually saved, same idea as
// the audit's "land on the first unanswered area" behaviour. Every step needs
// an answer before Continue, so this always matches how far they got.
function computeInitialStep(plan: ClearPlan, goal: Goal | null): number {
  if (!filled(plan.current_reality)) return 1;
  if (!filled(plan.life_vision)) return 2;
  if (!filled(plan.emotional_blocks)) return 3;
  if (!goal) return 4;
  if (!filled(goal.frequency) || !filled(goal.success_criteria)) return 5;
  return 6; // everything already saved — show the finished summary
}

type Fields = {
  currentReality: string;
  lifeVision: string;
  emotionalBlocks: string;
  goalTitle: string;
  actionText: string;
  motivationText: string;
  frequency: string;
  successCriteria: string;
};

const STEP_FIELDS: Record<number, (keyof Fields)[]> = {
  1: ["currentReality"],
  2: ["lifeVision"],
  3: ["emotionalBlocks"],
  4: ["goalTitle", "actionText", "motivationText"],
  5: ["frequency", "successCriteria"],
};

function pick(n: number, v: Fields): Partial<Fields> {
  return Object.fromEntries((STEP_FIELDS[n] ?? []).map((k) => [k, v[k]]));
}

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

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
  const [currentReality, setCurrentReality] = useState(plan.current_reality ?? "");
  const [lifeVision, setLifeVision] = useState(plan.life_vision ?? "");
  const [emotionalBlocks, setEmotionalBlocks] = useState(plan.emotional_blocks ?? "");
  // Their answer to "What would a [score + 1] look like?" from the snapshot.
  // It's quoted at the top of every step and seeds the goal as a first draft.
  const stepUp = plan.step_up_answer?.trim() || null;
  const [goalTitle, setGoalTitle] = useState(initialGoal?.goal_title ?? stepUp ?? "");
  const goalSeeded = !initialGoal && !!stepUp;
  const [actionText, setActionText] = useState(initialGoal?.action_text ?? "");
  const [motivationText, setMotivationText] = useState(initialGoal?.motivation_text ?? "");
  const [frequency, setFrequency] = useState(initialGoal?.frequency ?? "");
  const [successCriteria, setSuccessCriteria] = useState(initialGoal?.success_criteria ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [navigating, setNavigating] = useState(false);

  // What the database currently holds — "Saved" is only shown when the
  // screen matches it.
  const [saved, setSaved] = useState({
    currentReality: plan.current_reality ?? "",
    lifeVision: plan.life_vision ?? "",
    emotionalBlocks: plan.emotional_blocks ?? "",
    goalTitle: initialGoal?.goal_title ?? "",
    actionText: initialGoal?.action_text ?? "",
    motivationText: initialGoal?.motivation_text ?? "",
    frequency: initialGoal?.frequency ?? "",
    successCriteria: initialGoal?.success_criteria ?? "",
  });
  const current = { currentReality, lifeVision, emotionalBlocks, goalTitle, actionText, motivationText, frequency, successCriteria };
  // Saves run one at a time, so a slow earlier save can't overwrite a later one.
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const goalRef = useRef<Goal | null>(initialGoal);

  function stepDirty(n: number) {
    if (n === 1) return currentReality !== saved.currentReality;
    if (n === 2) return lifeVision !== saved.lifeVision;
    if (n === 3) return emotionalBlocks !== saved.emotionalBlocks;
    if (n === 4)
      return !goalRef.current || goalTitle !== saved.goalTitle || actionText !== saved.actionText || motivationText !== saved.motivationText;
    if (n === 5) return frequency !== saved.frequency || successCriteria !== saved.successCriteria;
    return false;
  }

  const canContinue =
    step === 1 ? filled(currentReality)
    : step === 2 ? filled(lifeVision)
    : step === 3 ? filled(emotionalBlocks)
    : step === 4 ? filled(goalTitle)
    : step === 5 ? filled(frequency) && filled(successCriteria)
    : true;
  const pct = Math.round((Math.min(step, TOTAL_STEPS) / TOTAL_STEPS) * 100);

  // Save whatever is on screen for step n. Returns false (and shows why) if it
  // didn't save; what they typed stays on screen either way.
  function persist(n: number): Promise<boolean> {
    const values = { ...current };
    const run = queue.current.then(async () => {
      let result: { ok: true } | { ok: false; message: string } = { ok: true };
      if (n === 4 && !goalRef.current && !filled(values.goalTitle)) return true; // nothing to create yet
      if (!stepDirtyFor(n, values)) return true;
      setStatus({ kind: "saving" });
      if (n === 1) result = await saveClearReflection(plan.id, { current_reality: values.currentReality });
      else if (n === 2) result = await saveClearReflection(plan.id, { life_vision: values.lifeVision });
      else if (n === 3) result = await saveClearReflection(plan.id, { emotional_blocks: values.emotionalBlocks });
      else if (n === 4) {
        const core = { goalTitle: values.goalTitle, actionText: values.actionText, motivationText: values.motivationText };
        if (goalRef.current) {
          result = await updateGoalCore(goalRef.current.id, core);
        } else {
          const created = await createGoalFromClear({ clearPlanId: plan.id, focusArea: area.name, ...core });
          if (created.ok) {
            goalRef.current = created.goal;
          }
          result = created.ok ? { ok: true } : created;
        }
      } else if (n === 5 && goalRef.current) {
        result = await saveGoalRoadmap(goalRef.current.id, { frequency: values.frequency, successCriteria: values.successCriteria });
      }
      if (!result.ok) {
        setStatus({ kind: "error", message: result.message });
        return false;
      }
      setSaved((prev) => ({ ...prev, ...pick(n, values) }));
      setStatus({ kind: "idle" });
      return true;
    });
    queue.current = run.catch(() => false);
    return run.catch(() => {
      setStatus({ kind: "error", message: "Couldn’t save — check your connection and try again." });
      return false;
    });
  }

  function stepDirtyFor(n: number, v: typeof current) {
    if (n === 4 && !goalRef.current) return true;
    const keys = STEP_FIELDS[n] ?? [];
    return keys.some((k) => v[k] !== savedRef.current[k]);
  }
  const savedRef = useRef(saved);
  savedRef.current = saved;

  async function next() {
    if (!canContinue) return;
    setNavigating(true);
    const ok = await persist(step);
    setNavigating(false);
    if (ok) {
      setStatus({ kind: "idle" });
      setStep((s) => s + 1);
    }
  }

  async function back() {
    if (step <= 1) return;
    setNavigating(true);
    await persist(step); // keep their words even if they step back; the text stays on screen if this fails
    setNavigating(false);
    setStep((s) => s - 1);
  }

  const saveOnBlur = () => {
    if (stepDirty(step)) void persist(step);
  };

  let statusText: string;
  if (status.kind === "saving") statusText = "Saving…";
  else if (status.kind === "error") statusText = status.message;
  else if (!canContinue) statusText = step === 4 ? "Add a goal to continue" : step === 5 ? "Fill in both to finish" : "Write a line or two to continue";
  else if (stepDirty(step)) statusText = "Not saved yet";
  else statusText = "Saved";

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
          <button className="tb-back" onClick={back} disabled={navigating}>← Back</button>
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

        {stepUp ? (
          <blockquote className="au-quote clear-quote">
            <cite>
              {plan.step_up_target ? `You said a ${plan.step_up_target} would look like` : "Your starting point"}
            </cite>
            <p>&ldquo;{stepUp}&rdquo;</p>
          </blockquote>
        ) : null}

        {step === 1 && (
          <>
            <h1>Where are things really at, right now?</h1>
            <p className="lead">Be honest, not diplomatic — this is just for you.</p>
            <textarea
              rows={6}
              value={currentReality}
              onChange={(e) => setCurrentReality(e.target.value)}
              onBlur={saveOnBlur}
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
              onBlur={saveOnBlur}
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
              onBlur={saveOnBlur}
              placeholder="What's actually been in the way?"
            />
          </>
        )}

        {step === 4 && (
          <>
            <h1>What&apos;s the one goal that moves this forward?</h1>
            <p className="lead">One goal, not five. Small and real beats big and vague.</p>
            <label className="lbl" htmlFor="goal-title">Goal</label>
            {goalSeeded ? <p className="au-start-help">Starting from what you said — edit it freely.</p> : null}
            <input
              type="text"
              id="goal-title"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              onBlur={saveOnBlur}
              placeholder="e.g. Build a consistent morning routine"
            />
            <label className="lbl" htmlFor="goal-action">The one action</label>
            <textarea
              id="goal-action"
              rows={3}
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              onBlur={saveOnBlur}
              placeholder="What will you actually do?"
            />
            <label className="lbl" htmlFor="goal-why">Why this matters</label>
            <textarea
              id="goal-why"
              rows={3}
              value={motivationText}
              onChange={(e) => setMotivationText(e.target.value)}
              onBlur={saveOnBlur}
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
              type="text"
              id="goal-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              onBlur={saveOnBlur}
              placeholder="e.g. Daily, most weekdays, 3x a week"
            />
            <label className="lbl" htmlFor="goal-success">Success looks like</label>
            <textarea
              id="goal-success"
              rows={3}
              value={successCriteria}
              onChange={(e) => setSuccessCriteria(e.target.value)}
              onBlur={saveOnBlur}
              placeholder="How will you know this is actually working?"
            />
          </>
        )}
      </div>

      <div className="foot-nav">
        <span className={`tb-label${status.kind === "error" ? " clear-err" : ""}`} aria-live="polite">{statusText}</span>
        <button className="btn btn-p" disabled={navigating || !canContinue} onClick={next}>
          {navigating ? "Saving…" : step === TOTAL_STEPS ? "Finish" : "Continue"}
        </button>
      </div>
    </>
  );
}
