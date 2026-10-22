"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveClearReflection, createGoalFromClear, updateGoalCore, saveGoalRoadmap } from "@/lib/actions/clear";
import type { ClearPlan, Goal } from "@/lib/actions/clear";
import type { LifeArea } from "@/lib/actions/audit";
import { formatDate } from "@/lib/audit-schedule";
import { ScoreTrack } from "@/components/audit/ScoreTrack";
import { REALITY_PROMPTS, withoutStarters } from "@/lib/clear-text";

const STEP_LABELS = ["Current reality", "Life vision", "What's in the way", "One action", "Roadmap and review"];
const TOTAL_STEPS = 5;

// E: the blocks people can tap, each with its own short follow-up.
export const BLOCKS: Record<string, string> = {
  Time: "What usually gets your time instead?",
  "Knowing where to start": "What's the very first thing you'd need to know or do?",
  Money: "Is it the amount itself, or not knowing where it goes?",
  Energy: "When in the week do you have the most energy for this?",
  Habit: "When does the old pattern usually win, and what sets it off?",
  Confidence: "What do you tell yourself when you think about tackling this?",
  "Other people": "Whose support, agreement or space would change this?",
  "Fear of getting it wrong": "What's the worst that could realistically happen, and could you handle it?",
  "It hasn't felt like a priority": "What's changed that makes it matter now?",
  "Something else": "What is it? Name it in your own words.",
};




const FREQUENCIES = ["Daily", "A few times a week", "Weekly", "Fortnightly", "Monthly"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

const filled = (v: string | null | undefined) => !!v?.trim();

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

function parseTime(text: string | null | undefined) {
  const m = text?.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return "";
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === "pm") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

function listDays(days: string[]) {
  const names = DAYS.filter((d) => days.includes(d));
  const full = names.map((d) => DAY_NAMES[d]);
  if (full.length <= 1) return full.join("");
  return `${full.slice(0, -1).join(", ")} and ${full[full.length - 1]}`;
}

// "Every Sunday at 6pm" — used for the goal sentence and stored as action_when.
function whenPhrase(frequency: string, days: string[], time: string) {
  const at = time ? ` at ${formatTime(time)}` : "";
  if (frequency === "Daily" || days.length === 7) return `Every day${at}`;
  if (days.length) return `Every ${listDays(days)}${at}`;
  const base: Record<string, string> = {
    "A few times a week": "A few times a week",
    Weekly: "Once a week",
    Fortnightly: "Every fortnight",
    Monthly: "Once a month",
  };
  return frequency ? `${base[frequency] ?? frequency}${at}` : at.trim();
}

function draftGoal(frequency: string, days: string[], time: string, action: string) {
  let act = action.trim().replace(/[.\s]+$/, "").replace(/^(i'?ll|i will|i)\s+/i, "");
  if (!act) return "";
  act = act.charAt(0).toLowerCase() + act.slice(1);
  const when = whenPhrase(frequency, days, time);
  return when ? `${when}, I'll ${act}.` : `I'll ${act}.`;
}

type Form = {
  currentReality: string;
  lifeVision: string;
  stepUp: string;
  blocks: string[];
  blockAnswers: Record<string, string>;
  biggestBlock: string;
  triedBefore: string;
  action: string;
  frequency: string;
  days: string[];
  time: string;
  goalTitle: string;
  motivation: string;
  success: string;
  ifObstacle: string;
  ifResponse: string;
};

const STEP_FIELDS: Record<number, (keyof Form)[]> = {
  1: ["currentReality"],
  2: ["lifeVision", "stepUp"],
  3: ["blocks", "blockAnswers", "biggestBlock", "triedBefore"],
  4: ["action", "frequency", "days", "time", "goalTitle", "motivation"],
  5: ["success", "ifObstacle", "ifResponse"],
};

function snapshotOf(n: number, f: Form) {
  return JSON.stringify((STEP_FIELDS[n] ?? []).map((k) => f[k]));
}

function initialForm(plan: ClearPlan, goal: Goal | null): Form {
  const when = goal?.action_when ?? "";
  const days = when.startsWith("Every day") ? [] : DAYS.filter((d) => when.includes(d));
  return {
    currentReality: plan.current_reality ?? "",
    lifeVision: plan.life_vision ?? "",
    stepUp: plan.step_up_answer ?? "",
    blocks: plan.blocks ?? [],
    blockAnswers: plan.block_answers ?? {},
    biggestBlock: plan.emotional_blocks ?? "",
    triedBefore: plan.tried_before ?? "",
    action: goal?.action_text ?? "",
    frequency: goal?.frequency?.trim() ?? "",
    days,
    time: parseTime(when),
    goalTitle: goal?.goal_title ?? "",
    motivation: goal?.motivation_text ?? "",
    success: goal?.success_criteria ?? plan.step_up_answer ?? "",
    ifObstacle: plan.if_obstacle ?? "",
    ifResponse: plan.if_response ?? "",
  };
}

// Where to resume: the first step that isn't complete.
function computeInitialStep(plan: ClearPlan, goal: Goal | null): number {
  if (!filled(withoutStarters(plan.current_reality ?? ""))) return 1;
  if (!filled(plan.life_vision) || !filled(plan.step_up_answer)) return 2;
  if (!filled(plan.emotional_blocks) || !(plan.blocks?.length ?? 0)) return 3;
  if (!goal || !filled(goal.frequency)) return 4;
  if (!filled(goal.success_criteria)) return 5;
  return 6;
}

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

export function ClearWizard({
  area,
  plan,
  goal: initialGoal,
  score,
  auditNote,
  lowWellbeing,
  nextAuditDue,
  startAtStep = null,
}: {
  area: LifeArea;
  plan: ClearPlan;
  goal: Goal | null;
  score: number;
  auditNote: string | null;
  // Emotional Wellbeing scored very low: soften step 3 and point to support.
  lowWellbeing: boolean;
  nextAuditDue: string;
  // Reviewing or adjusting: open on this step instead of where they left off.
  startAtStep?: number | null;
}) {
  const target = Math.min(10, score + 1);
  const [step, setStep] = useState(() => startAtStep ?? computeInitialStep(plan, initialGoal));
  const [form, setForm] = useState<Form>(() => initialForm(plan, initialGoal));
  // What's actually in the database — pre-filled suggestions (like success
  // from their "5") aren't saved until they continue.
  const [saved, setSaved] = useState<Form>(() => ({ ...initialForm(plan, initialGoal), success: initialGoal?.success_criteria ?? "" }));
  // Once someone edits the drafted goal sentence, stop rewriting it for them.
  const [goalEdited, setGoalEdited] = useState(() => filled(initialGoal?.goal_title));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [navigating, setNavigating] = useState(false);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const goalRef = useRef<Goal | null>(initialGoal);
  const formRef = useRef(form);
  formRef.current = form;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const realityRef = useRef<HTMLTextAreaElement>(null);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => {
      const nextForm = { ...f, [key]: value };
      if (!goalEdited && (key === "action" || key === "frequency" || key === "days" || key === "time")) {
        nextForm.goalTitle = draftGoal(nextForm.frequency, nextForm.days, nextForm.time, nextForm.action);
      }
      return nextForm;
    });
  }

  const dirty = (n: number) => snapshotOf(n, form) !== snapshotOf(n, saved) || (n === 4 && !goalRef.current);

  const canContinue =
    step === 1 ? filled(withoutStarters(form.currentReality))
    : step === 2 ? filled(form.lifeVision) && filled(form.stepUp)
    : step === 3 ? form.blocks.length > 0 && filled(form.biggestBlock)
    : step === 4 ? filled(form.action) && filled(form.frequency) && filled(form.goalTitle)
    : step === 5 ? filled(form.success)
    : true;

  // Save whatever is on screen for step n. Returns false (and says why) if it
  // didn't save; what they typed stays on screen either way.
  function persist(n: number): Promise<boolean> {
    const f = formRef.current;
    const run = queue.current.then(async () => {
      if (snapshotOf(n, f) === snapshotOf(n, savedRef.current) && !(n === 4 && !goalRef.current)) return true;
      if (n === 4 && !goalRef.current && !(filled(f.action) && filled(f.frequency) && filled(f.goalTitle))) return true;
      setStatus({ kind: "saving" });
      let result: { ok: true } | { ok: false; message: string } = { ok: true };
      const when = whenPhrase(f.frequency, f.days, f.time);
      if (n === 1) result = await saveClearReflection(plan.id, { current_reality: f.currentReality });
      else if (n === 2)
        result = await saveClearReflection(plan.id, { life_vision: f.lifeVision, step_up_answer: f.stepUp, step_up_target: target });
      else if (n === 3)
        result = await saveClearReflection(plan.id, {
          blocks: f.blocks,
          block_answers: Object.fromEntries(Object.entries(f.blockAnswers).filter(([b]) => f.blocks.includes(b))),
          emotional_blocks: f.biggestBlock,
          tried_before: f.triedBefore,
        });
      else if (n === 4) {
        const core = { goalTitle: f.goalTitle, actionText: f.action, motivationText: f.motivation, frequency: f.frequency, actionWhen: when };
        if (goalRef.current) {
          result = await updateGoalCore(goalRef.current.id, core);
        } else {
          const created = await createGoalFromClear({ clearPlanId: plan.id, focusArea: area.name, ...core });
          if (created.ok) goalRef.current = created.goal;
          result = created.ok ? { ok: true } : created;
        }
      } else if (n === 5 && goalRef.current) {
        result = await saveGoalRoadmap(goalRef.current.id, { successCriteria: f.success });
        if (result.ok) result = await saveClearReflection(plan.id, { if_obstacle: f.ifObstacle, if_response: f.ifResponse });
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
    setNavigating(false);
    if (ok) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0 });
    }
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

  function addPrompt(starter: string) {
    const current = form.currentReality.trimEnd();
    const nextText = current ? `${current}\n${starter}` : starter;
    set("currentReality", nextText);
    requestAnimationFrame(() => {
      const el = realityRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextText.length, nextText.length);
      }
    });
  }

  function toggle(key: "blocks" | "days", value: string) {
    const list = form[key];
    set(key, list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  let statusText: string;
  if (status.kind === "saving") statusText = "Saving…";
  else if (status.kind === "error") statusText = status.message;
  else if (!canContinue)
    statusText =
      step === 3 ? "Tap at least one, then say which matters most"
      : step === 4 ? "Add your action and how often"
      : step === 2 ? "Answer both to continue"
      : "Write a line or two to continue";
  else if (dirty(step)) statusText = "Not saved yet";
  else statusText = "Saved";

  if (step === 6) return <FinishRedirect />;

  const actionWords = form.action.trim().split(/\s+/).filter(Boolean).length;
  const checkins = [1, 2]
    .map((m) => {
      const d = new Date();
      d.setMonth(d.getMonth() + m);
      return d;
    })
    .filter((d) => d < new Date(nextAuditDue));

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
      <ol className="clear-stepper" role="progressbar" aria-label="CLEAR progress" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step} aria-valuetext={`Step ${step} of ${TOTAL_STEPS}: ${STEP_LABELS[step - 1]}`}>
        {"CLEAR".split("").map((letter, i) => (
          <li key={i} className={i + 1 === step ? "on" : i + 1 < step ? "done" : undefined} title={STEP_LABELS[i]}><span>{letter}</span></li>
        ))}
      </ol>

      <div className="page au-page clear-step">
        <div className="eyebrow"><span className="eydot" /> CLEAR · {area.name}</div>

        {step === 1 && (
          <>
            <h1 className="clear-h">Current <em>reality</em></h1>
            <div className="au-sum-card clear-from">
              <p className="au-detail-k">From your audit</p>
              <p className="au-latest-big">{area.name} <span>{score}/10</span></p>
              {auditNote ? <p className="clear-note">&ldquo;{auditNote}&rdquo;</p> : null}
            </div>
            <label className="au-start-q" htmlFor="c-reality">What&rsquo;s behind that {score}?</label>
            <p className="au-start-help">Tap a prompt to start, or write freely.</p>
            <div className="au-chips">
              {REALITY_PROMPTS.map((p) => (
                <button key={p} type="button" onClick={() => addPrompt(p)}>{p.replace(/: $/, "")}</button>
              ))}
            </div>
            <textarea
              id="c-reality"
              ref={realityRef}
              rows={6}
              value={form.currentReality}
              onChange={(e) => set("currentReality", e.target.value)}
              onBlur={saveOnBlur}
              placeholder="Where this area honestly is today…"
            />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="clear-h">Life <em>vision</em></h1>
            <label className="au-start-q" htmlFor="l-vision">The direction: what would a 10 look like?</label>
            <p className="au-start-help">One or two sentences. This is where you&rsquo;re heading, not this quarter&rsquo;s target.</p>
            <textarea id="l-vision" rows={3} value={form.lifeVision} onChange={(e) => set("lifeVision", e.target.value)} onBlur={saveOnBlur} placeholder="At a 10, this area would feel…" />
            <label className="au-start-q" htmlFor="l-step">
              The next step: what would a {target} look like?
              {filled(plan.step_up_answer) ? <span className="clear-tag">From your snapshot</span> : null}
            </label>
            <p className="au-start-help">Not a complete fix — one honest step up. This becomes the target for this goal.</p>
            <textarea id="l-step" rows={3} value={form.stepUp} onChange={(e) => set("stepUp", e.target.value)} onBlur={saveOnBlur} placeholder={`A ${target} would mean…`} />
            <div className="clear-track-wrap"><ScoreTrack score={score} target={target} /></div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="clear-h">What&rsquo;s been <em>in the way</em></h1>
            <p className="au-start-help">
              {lowWellbeing
                ? "Take this at your own pace. Tap any that fit — there’s no wrong answer, and you can keep it brief."
                : "Tap any that apply. Each one asks a short follow-up. There’s no wrong answer."}
            </p>
            <div className="au-chips" role="group" aria-label="What’s been in the way">
              {Object.keys(BLOCKS).map((b) => (
                <button key={b} type="button" aria-pressed={form.blocks.includes(b)} onClick={() => toggle("blocks", b)}>{b}</button>
              ))}
            </div>
            {form.blocks.map((b) => (
              <div key={b} className="clear-followup">
                <p className="au-detail-k">{b}</p>
                <label htmlFor={`b-${b}`}>{BLOCKS[b]}</label>
                <textarea
                  id={`b-${b}`}
                  rows={2}
                  value={form.blockAnswers[b] ?? ""}
                  onChange={(e) => set("blockAnswers", { ...form.blockAnswers, [b]: e.target.value })}
                  onBlur={saveOnBlur}
                />
              </div>
            ))}
            <label className="au-start-q" htmlFor="e-biggest">Of these, which matters most, and why?</label>
            <textarea id="e-biggest" rows={3} value={form.biggestBlock} onChange={(e) => set("biggestBlock", e.target.value)} onBlur={saveOnBlur} placeholder="Write a sentence or two…" />
            <label className="au-start-q clear-q-sm" htmlFor="e-tried">
              When you&rsquo;ve tried to change this before, what happened? <span className="au-small">Optional</span>
            </label>
            <textarea id="e-tried" rows={2} value={form.triedBefore} onChange={(e) => set("triedBefore", e.target.value)} onBlur={saveOnBlur} placeholder="What you tried, and what stopped it…" />
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
            <h1 className="clear-h">One <em>action</em></h1>
            <label className="au-start-q" htmlFor="a-action">What will you do?</label>
            <p className="au-start-help">Start with a verb. Make it small enough that you&rsquo;d still do it on a bad week.</p>
            <textarea id="a-action" rows={2} value={form.action} onChange={(e) => set("action", e.target.value)} onBlur={saveOnBlur} placeholder="Check my bank and update my spending sheet" />
            {actionWords > 25 ? <p className="clear-nudge">That&rsquo;s quite a lot for one action. Could it be smaller?</p> : null}
            <p className="au-start-q">How often?</p>
            <div className="au-chips" role="group" aria-label="How often">
              {FREQUENCIES.map((f) => (
                <button key={f} type="button" aria-pressed={form.frequency === f} onClick={() => set("frequency", f)}>{f}</button>
              ))}
            </div>
            {form.frequency && form.frequency !== "Daily" ? (
              <>
                <p className="au-start-q clear-q-sm">Which days? <span className="au-small">Optional</span></p>
                <div className="au-chips" role="group" aria-label="Which days">
                  {DAYS.map((d) => (
                    <button key={d} type="button" aria-pressed={form.days.includes(d)} onClick={() => toggle("days", d)}>{d}</button>
                  ))}
                </div>
              </>
            ) : null}
            <label className="au-start-q clear-q-sm" htmlFor="a-time">What time? <span className="au-small">Optional</span></label>
            <input id="a-time" type="time" className="clear-time" value={form.time} onChange={(e) => set("time", e.target.value)} onBlur={saveOnBlur} />
            <div className="au-sum-card clear-goal-draft">
              <p className="au-detail-k">{goalEdited ? "Your goal" : "Your goal, written for you — edit freely"}</p>
              <textarea
                aria-label="Your goal"
                rows={2}
                value={form.goalTitle}
                onChange={(e) => {
                  setGoalEdited(true);
                  set("goalTitle", e.target.value);
                }}
                onBlur={saveOnBlur}
                placeholder="Choose your action and how often, and your goal appears here."
              />
            </div>
            <label className="au-start-q" htmlFor="a-why">Why does this matter to you?</label>
            <textarea id="a-why" rows={2} value={form.motivation} onChange={(e) => set("motivation", e.target.value)} onBlur={saveOnBlur} placeholder="Because…" />
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="clear-h">Roadmap and <em>review</em></h1>
            <label className="au-start-q" htmlFor="r-success">
              Success looks like <span className="clear-tag">Your {target}</span>
            </label>
            <p className="au-start-help">What would you see or be able to count that tells you the goal is done? Doing the action once is practice; this is the finish line.</p>
            <textarea id="r-success" rows={2} value={form.success} onChange={(e) => set("success", e.target.value)} onBlur={saveOnBlur} />
            <p className="au-start-q">If something gets in the way, what will you do?</p>
            <p className="au-start-help">
              {filled(form.triedBefore) ? `You said: “${form.triedBefore.trim()}” — plan for that.` : "Think of the most likely thing that could stop you."}
            </p>
            <div className="clear-ifthen">
              <label htmlFor="r-if">If</label>
              <input id="r-if" type="text" value={form.ifObstacle} onChange={(e) => set("ifObstacle", e.target.value)} onBlur={saveOnBlur} placeholder="I miss Sunday" />
              <label htmlFor="r-then">then I&rsquo;ll</label>
              <input id="r-then" type="text" value={form.ifResponse} onChange={(e) => set("ifResponse", e.target.value)} onBlur={saveOnBlur} placeholder="do it Monday before work" />
            </div>
            <p className="au-start-q">Your goal check-ins</p>
            <div className="au-chips clear-dates">
              {checkins.map((d) => (
                <span key={d.toISOString()}>{formatDate(d)} · goal check-in</span>
              ))}
              <span className="audit">{formatDate(nextAuditDue)} · suggested whole-life audit</span>
            </div>
          </>
        )}
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

function FinishRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/clear");
    router.refresh();
  }, [router]);
  return (
    <div className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
      <div className="eyebrow"><span className="eydot" /> CLEAR complete</div>
      <h1>Your plan is set.</h1>
      <p className="lead" style={{ margin: "0 auto" }}>Opening your plan…</p>
    </div>
  );
}
