"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveClearReflection, createGoalFromClear, updateGoalCore, saveGoalRoadmap } from "@/lib/actions/clear";
import type { ClearPlan, Goal } from "@/lib/actions/clear";
import type { LifeArea } from "@/lib/actions/audit";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { clipFor } from "@/lib/learn-content";
import {
  ACTION_IDEAS,
  DAYS,
  HARD_WEEK,
  STEP_NAMES,
  WAY_OPTIONS,
  actionHint,
  frequencyOf,
  goalSentence,
  parseWhen,
  whenPhrase,
} from "@/lib/plan-action";
import { firstActionDate, longDay, upcomingReviews } from "@/lib/review-schedule";

const TOTAL_STEPS = 5;
const STEP_FILMS = [
  "Duane on choosing your starting point",
  "Duane on what better looks like, and why it matters",
  "Duane on what gets in the way",
  "Duane on turning an idea into one clear action",
  "Duane on knowing it’s helping",
];

const filled = (v: string | null | undefined) => !!v?.trim();

type Form = {
  stepUp: string;
  anything: string;
  why: string;
  lifeVision: string;
  way: string;
  wayNote: string;
  action: string;
  days: string[];
  time: string;
  after: string;
  fallback: string;
  success: string;
};

const STEP_FIELDS: Record<number, (keyof Form)[]> = {
  1: ["stepUp", "anything"],
  2: ["stepUp", "why", "lifeVision"],
  3: ["way", "wayNote"],
  4: ["action", "days", "time", "after", "fallback"],
  5: ["success"],
};

function snapshotOf(n: number, f: Form) {
  return JSON.stringify((STEP_FIELDS[n] ?? []).map((k) => f[k]));
}

function initialForm(plan: ClearPlan, goal: Goal | null): Form {
  const when = parseWhen(goal?.action_when);
  const way = plan.blocks?.[0] ?? "";
  return {
    stepUp: plan.step_up_answer ?? "",
    anything: plan.current_reality ?? "",
    why: plan.why_it_matters ?? goal?.motivation_text ?? "",
    lifeVision: plan.life_vision ?? "",
    way,
    wayNote: (way && plan.block_answers?.[way]) || "",
    action: goal?.action_text ?? "",
    days: when.days,
    time: when.time,
    after: when.after,
    fallback: plan.if_response ?? "",
    success: goal?.success_criteria ?? "",
  };
}

// Where to resume: the first step that isn't complete. Step 1 is usually
// done already, on the snapshot.
function computeInitialStep(plan: ClearPlan, goal: Goal | null): number {
  if (!filled(plan.step_up_answer)) return 1;
  if (!filled(plan.why_it_matters ?? goal?.motivation_text)) return 2;
  if (!(plan.blocks?.length ?? 0)) return 3;
  if (!goal || !filled(goal.frequency)) return 4;
  if (!filled(goal.success_criteria)) return 5;
  return 6;
}

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

// Build your plan: five guided steps, one plain question each, with the plan
// taking shape beside them. Step 1 (the starting point) is answered on the
// snapshot, so most people arrive at step 2 with it ticked.
export function ClearWizard({
  area,
  plan,
  goal: initialGoal,
  score,
  auditNote,
  lowWellbeing,
  canChangeArea,
  startAtStep = null,
}: {
  area: LifeArea;
  plan: ClearPlan;
  goal: Goal | null;
  score: number;
  auditNote: string | null;
  // Emotional Wellbeing scored very low: soften step 3 and point to support.
  lowWellbeing: boolean;
  // Before the plan has really started, the area can still be changed.
  canChangeArea: boolean;
  // Reviewing or adjusting: open on this step instead of where they left off.
  startAtStep?: number | null;
}) {
  const router = useRouter();
  const target = Math.min(10, score + 1);
  const [step, setStep] = useState(() => Math.min(TOTAL_STEPS, startAtStep ?? computeInitialStep(plan, initialGoal)));
  const [form, setForm] = useState<Form>(() => initialForm(plan, initialGoal));
  const [saved, setSaved] = useState<Form>(() => initialForm(plan, initialGoal));
  const [showVision, setShowVision] = useState(() => filled(plan.life_vision));
  const [idea, setIdea] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [navigating, setNavigating] = useState(false);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const goalRef = useRef<Goal | null>(initialGoal);
  const formRef = useRef(form);
  formRef.current = form;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const sentence = goalSentence(form.days, form.time, form.after, form.action);
  const hint = actionHint(form.action, form.days, form.time);
  const dirty = (n: number) => snapshotOf(n, form) !== snapshotOf(n, saved) || (n === 4 && !goalRef.current);

  const canContinue =
    step === 1 ? filled(form.stepUp)
    : step === 2 ? filled(form.stepUp) && filled(form.why)
    : step === 3 ? filled(form.way)
    : step === 4 ? filled(form.action) && form.days.length > 0
    : step === 5 ? filled(form.success)
    : true;

  // Save whatever is on screen for step n. Returns false (and says why) if it
  // didn't save; what they typed stays on screen either way.
  function persist(n: number): Promise<boolean> {
    const f = formRef.current;
    const run = queue.current.then(async () => {
      if (snapshotOf(n, f) === snapshotOf(n, savedRef.current) && !(n === 4 && !goalRef.current)) return true;
      if (n === 4 && !goalRef.current && !(filled(f.action) && f.days.length)) return true;
      setStatus({ kind: "saving" });
      let result: { ok: true } | { ok: false; message: string } = { ok: true };
      const core = {
        goalTitle: goalSentence(f.days, f.time, f.after, f.action),
        actionText: f.action.trim(),
        motivationText: f.why.trim(),
        frequency: frequencyOf(f.days),
        actionWhen: whenPhrase(f.days, f.time, f.after),
      };
      if (n === 1) {
        result = await saveClearReflection(plan.id, { step_up_answer: f.stepUp, step_up_target: target, current_reality: f.anything });
      } else if (n === 2) {
        result = await saveClearReflection(plan.id, { step_up_answer: f.stepUp, step_up_target: target, why_it_matters: f.why, life_vision: f.lifeVision });
        if (result.ok && goalRef.current) result = await updateGoalCore(goalRef.current.id, core);
      } else if (n === 3) {
        result = await saveClearReflection(plan.id, {
          blocks: f.way ? [f.way] : [],
          block_answers: f.way && f.wayNote.trim() ? { [f.way]: f.wayNote.trim() } : {},
          emotional_blocks: f.wayNote.trim() || f.way,
        });
      } else if (n === 4) {
        result = await saveClearReflection(plan.id, {
          if_obstacle: f.fallback.trim() ? HARD_WEEK : null,
          if_response: f.fallback.trim() || null,
        });
        if (result.ok) {
          if (goalRef.current) {
            result = await updateGoalCore(goalRef.current.id, core);
          } else {
            const created = await createGoalFromClear({ clearPlanId: plan.id, focusArea: area.name, ...core });
            if (created.ok) goalRef.current = created.goal;
            result = created.ok ? { ok: true } : created;
          }
        }
      } else if (n === 5 && goalRef.current) {
        result = await saveGoalRoadmap(goalRef.current.id, { successCriteria: f.success });
      }
      if (!result.ok) {
        setStatus({ kind: "error", message: result.message });
        return false;
      }
      setSaved((prev) => {
        const nextSaved = { ...prev };
        for (const k of STEP_FIELDS[n] ?? []) (nextSaved as Record<string, unknown>)[k] = f[k];
        return nextSaved;
      });
      setStatus({ kind: "idle" });
      return true;
    });
    queue.current = run.catch(() => false);
    return run.catch(() => {
      setStatus({ kind: "error", message: "Couldn’t save — check your connection and try again." });
      return false;
    });
  }

  async function next() {
    if (!canContinue) return;
    setNavigating(true);
    const ok = await persist(step);
    if (!ok) return setNavigating(false);
    if (step === TOTAL_STEPS) {
      router.push("/clear/set");
      router.refresh();
      return;
    }
    setNavigating(false);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  }

  async function back() {
    if (step <= 1) return;
    setNavigating(true);
    await persist(step); // keep their words; the text stays on screen even if this fails
    setNavigating(false);
    setStep((s) => s - 1);
    window.scrollTo({ top: 0 });
  }

  const saveOnBlur = () => {
    if (dirty(step)) void persist(step);
  };

  function toggleDay(d: string) {
    set("days", form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d]);
  }

  let statusText: string;
  if (status.kind === "saving") statusText = "Saving…";
  else if (status.kind === "error") statusText = status.message;
  else if (!canContinue)
    statusText =
      step === 3 ? "Tap the one most likely to get in the way"
      : step === 4 ? "Say what you’ll do, and choose a day"
      : step === 2 ? "Add why it matters to continue"
      : "Write a line to continue";
  else if (dirty(step)) statusText = "Not saved yet";
  else statusText = "Saved";

  const ideas = ACTION_IDEAS[area.name] ?? [];
  const today = new Date().toISOString();
  const firstTry = firstActionDate(today, whenPhrase(form.days, form.time, form.after));
  const reviews = upcomingReviews(today, whenPhrase(form.days, form.time, form.after));

  // Duane's film for each step, shown in the step itself, as in the audit.
  const film = (n: number) => (
    <div className="bp-video">
      <GuideVideo clip={clipFor(`plan-step-${n}`, `Build your plan: ${STEP_NAMES[n - 1]}`, null)} caption={STEP_FILMS[n - 1]} />
    </div>
  );

  return (
    <>
      <div className="topbar">
        {step > 1 ? (
          <button className="tb-back" onClick={back} disabled={navigating}>← Back</button>
        ) : (
          <Link href="/audit/results" className="tb-back">← My snapshot</Link>
        )}
        <span className="tb-label">Step {step} of {TOTAL_STEPS} · {STEP_NAMES[step - 1]}</span>
      </div>
      <ol
        className="bp-progress"
        role="progressbar"
        aria-label="Build your plan"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
        aria-valuetext={`Step ${step} of ${TOTAL_STEPS}: ${STEP_NAMES[step - 1]}`}
      >
        {STEP_NAMES.map((name, i) => (
          <li key={name} className={i + 1 === step ? "on" : i + 1 < step ? "done" : undefined}>
            <span className="bp-seg" aria-hidden="true" />
            <span className="bp-name">{name}</span>
          </li>
        ))}
      </ol>

      <div className="page au-page clear-step bp-page">
        <div className="bp-layout">
          <div className="bp-main">
            <div className="eyebrow"><span className="eydot" /> Build your plan · {area.name}</div>

            {step === 1 && (
              <>
                <h1 className="clear-h">Your starting point</h1>
                {film(1)}
                <p className="au-start-help">You&rsquo;ve seen the wider picture. Now turn one area into something you can act on.</p>
                <div className="au-sum-card clear-from">
                  <p className="au-detail-k">From your snapshot</p>
                  <p className="au-latest-big">{area.name} <span>{score}/10</span></p>
                  {auditNote ? <p className="clear-note">&ldquo;{auditNote}&rdquo;</p> : null}
                  {canChangeArea ? <Link href="/clear?choose=1" className="au-text-link">Start with a different area</Link> : null}
                </div>
                <label className="au-start-q" htmlFor="b-stepup">What would a {target} look like?</label>
                <p className="au-start-help">Not a complete fix. One honest step up.</p>
                <textarea id="b-stepup" rows={3} value={form.stepUp} onChange={(e) => set("stepUp", e.target.value)} onBlur={saveOnBlur} placeholder={`A ${target} would mean…`} />
                <label className="au-start-q clear-q-sm" htmlFor="b-anything">Anything to add about where it is now? <span className="au-small">Optional</span></label>
                <textarea id="b-anything" rows={2} value={form.anything} onChange={(e) => set("anything", e.target.value)} onBlur={saveOnBlur} />
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="clear-h">Why does it matter to you?</h1>
                {film(2)}
                <div className="au-sum-card bp-said">
                  <label className="au-detail-k" htmlFor="b-stepup2">You said a {target} would look like</label>
                  <textarea id="b-stepup2" rows={2} value={form.stepUp} onChange={(e) => set("stepUp", e.target.value)} onBlur={saveOnBlur} />
                </div>
                <label className="au-start-q" htmlFor="b-why">Why it matters</label>
                <p className="au-start-help">A sentence is enough. This is what you&rsquo;ll come back to on a hard week.</p>
                <textarea id="b-why" rows={3} value={form.why} onChange={(e) => set("why", e.target.value)} onBlur={saveOnBlur} placeholder="Because…" />
                {showVision ? (
                  <>
                    <label className="au-start-q clear-q-sm" htmlFor="b-vision">Where you&rsquo;re heading: what would a 10 look like? <span className="au-small">Optional</span></label>
                    <textarea id="b-vision" rows={2} value={form.lifeVision} onChange={(e) => set("lifeVision", e.target.value)} onBlur={saveOnBlur} />
                  </>
                ) : (
                  <button type="button" className="au-text-link as-btn bp-more" onClick={() => setShowVision(true)}>+ Add where you&rsquo;re heading (optional)</button>
                )}
                <p className="bp-example"><b>Example (fictional):</b> Alex chose Money &amp; Stability. &ldquo;I&rsquo;m tired of the dread every payday.&rdquo;</p>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="clear-h">What might get in the way?</h1>
                {film(3)}
                <p className="au-start-help">
                  {lowWellbeing
                    ? "Take this at your own pace. Tap the one that fits best; you don’t have to explain it."
                    : "Tap the one most likely to. You don’t have to explain it."}
                </p>
                <div className="au-chips" role="group" aria-label="What might get in the way">
                  {WAY_OPTIONS.map((w) => (
                    <button key={w} type="button" aria-pressed={form.way === w} onClick={() => set("way", form.way === w ? "" : w)}>{w}</button>
                  ))}
                </div>
                {form.way && form.way !== "Nothing obvious yet" ? (
                  <>
                    <label className="au-start-q clear-q-sm" htmlFor="b-waynote">Anything you&rsquo;d like to add? <span className="au-small">Optional</span></label>
                    <textarea id="b-waynote" rows={2} value={form.wayNote} onChange={(e) => set("wayNote", e.target.value)} onBlur={saveOnBlur} />
                  </>
                ) : null}
                <p className="bp-example"><b>Example (fictional):</b> Alex tapped &ldquo;I put it off when it feels hard.&rdquo;</p>
                {lowWellbeing ? (
                  <div className="au-sum-card clear-support">
                    <h3>You don&rsquo;t have to do this alone</h3>
                    <p>
                      If things feel heavy right now, it&rsquo;s worth talking to someone you trust, your GP, or a qualified
                      professional. If you&rsquo;re in crisis, contact your local emergency services or a crisis line.
                    </p>
                  </div>
                ) : null}
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="clear-h">What will you do, and when?</h1>
                {film(4)}
                <p className="bp-move">1 · Start from an idea</p>
                <div className="au-chips" role="group" aria-label="Ideas to start from">
                  {ideas.map((i) => (
                    <button
                      key={i.label}
                      type="button"
                      aria-pressed={idea === i.label}
                      onClick={() => {
                        setIdea(i.label);
                        set("action", i.what);
                      }}
                    >
                      {i.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={idea === "own"}
                    onClick={() => {
                      setIdea("own");
                      set("action", "");
                      requestAnimationFrame(() => document.getElementById("b-action")?.focus());
                    }}
                  >
                    Write my own
                  </button>
                </div>

                <p className="bp-move">2 · Make it specific</p>
                <label className="au-start-q clear-q-sm" htmlFor="b-action">What exactly?</label>
                <input id="b-action" type="text" value={form.action} onChange={(e) => set("action", e.target.value)} onBlur={saveOnBlur} placeholder="Spend ten minutes on my spending sheet" />
                <p className="au-start-q clear-q-sm">Which day?</p>
                <div className="au-chips" role="group" aria-label="Which days">
                  {DAYS.map((d) => (
                    <button key={d} type="button" aria-pressed={form.days.includes(d)} onClick={() => toggleDay(d)}>{d}</button>
                  ))}
                  <button type="button" aria-pressed={form.days.length === 7} onClick={() => set("days", form.days.length === 7 ? [] : [...DAYS])}>Every day</button>
                </div>
                <div className="bp-two">
                  <div>
                    <label className="au-start-q clear-q-sm" htmlFor="b-time">What time?</label>
                    <input id="b-time" type="time" className="clear-time" value={form.time} onChange={(e) => set("time", e.target.value)} onBlur={saveOnBlur} />
                  </div>
                  <div>
                    <label className="au-start-q clear-q-sm" htmlFor="b-after">After what? <span className="au-small">Optional</span></label>
                    <input id="b-after" type="text" value={form.after} onChange={(e) => set("after", e.target.value)} onBlur={saveOnBlur} placeholder="after dinner" />
                  </div>
                </div>

                <p className="bp-move">3 · Make it small enough</p>
                <label className="au-start-q clear-q-sm" htmlFor="b-fallback">Could you do this on your worst week? If not, what&rsquo;s the smallest version?</label>
                <input id="b-fallback" type="text" value={form.fallback} onChange={(e) => set("fallback", e.target.value)} onBlur={saveOnBlur} placeholder="Open the app and look at the balance" />

                <div className="au-sum-card bp-action-card" aria-live="polite">
                  <p className="au-detail-k">Your action</p>
                  <p className="bp-sentence">{sentence || "Choose an idea or write your own, and your action appears here."}</p>
                  {sentence ? (
                    hint ? <p className="bp-hint warn">{hint}</p> : <p className="bp-hint ok">&#10003; Someone watching would know whether you did it.</p>
                  ) : null}
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <h1 className="clear-h">What would tell you this is helping?</h1>
                {film(5)}
                <label className="au-start-q clear-q-sm" htmlFor="b-success">How you&rsquo;ll know</label>
                <p className="au-start-help">Something you&rsquo;d notice in a few weeks. It doesn&rsquo;t need to be a finish line.</p>
                <textarea id="b-success" rows={3} value={form.success} onChange={(e) => set("success", e.target.value)} onBlur={saveOnBlur} />
                <div className="au-sum-card bp-said">
                  <p className="au-detail-k">Your first weekly review</p>
                  <p>
                    {reviews[0] ? longDay(reviews[0].date) : "A week from now"}
                    {firstTry ? `, the day after your first try on ${longDay(firstTry)}` : ""}. About a minute; we&rsquo;ll remind you by email.
                  </p>
                </div>
                <p className="bp-example"><b>Example (fictional):</b> &ldquo;I&rsquo;ll know my balance without checking, and Sundays stop feeling heavy.&rdquo;</p>
              </>
            )}
          </div>

          <aside className="bp-card" aria-label="Your plan so far">
            <p className="bp-card-k">Your plan so far</p>
            <dl>
              <dt>My focus</dt>
              <dd>{area.name}, from {score} towards {target}</dd>
              {filled(form.stepUp) ? (<><dt>Better looks like</dt><dd>{form.stepUp}</dd></>) : null}
              {filled(form.why) ? (<><dt>Why it matters</dt><dd>{form.why}</dd></>) : null}
              {step > 3 && filled(form.way) ? (<><dt>In the way</dt><dd>{form.way}</dd></>) : null}
              {step > 4 && sentence ? (<><dt>My action</dt><dd>{sentence}</dd></>) : null}
              {step > 4 && filled(form.fallback) ? (<><dt>My fallback</dt><dd>{form.fallback}</dd></>) : null}
            </dl>
          </aside>
        </div>
      </div>

      <div className="foot-nav">
        <span className={`tb-label${status.kind === "error" ? " clear-err" : ""}`} aria-live="polite">{statusText}</span>
        <button className="btn btn-p" disabled={navigating || !canContinue} onClick={next}>
          {navigating ? "Saving…" : step === TOTAL_STEPS ? "Set my plan →" : "Continue →"}
        </button>
      </div>
    </>
  );
}
