"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDailyMinutes, cancelTimer, countDailyAction, finishTimer, noteOnAction, pauseTimer, saveCheckIn, saveDailyAction,
  setDailyActionStatus, setRun, startTimer, tickDailyAction, type ActionInput, type DailyData,
} from "@/lib/actions/daily";
import {
  ACTION_ADVICE_LIMIT, MEASURES, clock, dueOn, looksMindful, mindfulOf, minutesOf, progressOf, scheduleLabel, timerState, weekStrip,
  welcomeBack, type DailyAction, type Measure, type Period,
} from "@/lib/daily-alignment";
import { DAY_NAMES } from "@/lib/daily-log";

type Area = { id: string; name: string };
type Step = { id: string; title: string };
type Res = { ok: boolean; message?: string };

export function DailyView({
  data, view: initialView, areas, steps, focusAreaId, nextStep,
}: {
  data: DailyData;
  view: "today" | "week";
  areas: Area[];
  steps: Step[];
  focusAreaId: string | null;
  nextStep: React.ReactNode;
}) {
  const [view, setView] = useState(initialView);
  const go = (v: "today" | "week") => {
    setView(v);
    window.history.replaceState(null, "", v === "week" ? "/daily?view=week" : "/daily");
  };
  return (
    <>
      <div className="da-tabs" role="tablist" aria-label="Daily Alignment">
        <button type="button" role="tab" id="da-tab-today" aria-selected={view === "today"} aria-controls="da-today" onClick={() => go("today")}>Today</button>
        <button type="button" role="tab" id="da-tab-week" aria-selected={view === "week"} aria-controls="da-week" onClick={() => go("week")}>Week</button>
        <Link href="/journal" className="da-tab-link">Journal →</Link>
      </div>
      <div role="tabpanel" id="da-today" aria-labelledby="da-tab-today" hidden={view !== "today"}>
        <TodayView data={data} areas={areas} steps={steps} focusAreaId={focusAreaId} nextStep={nextStep} />
      </div>
      <div role="tabpanel" id="da-week" aria-labelledby="da-tab-week" hidden={view !== "week"}>
        <WeekView data={data} areas={areas} />
      </div>
    </>
  );
}

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(step: () => Promise<Res>) {
    setBusy(true);
    setError(null);
    const r = await step();
    setBusy(false);
    if (!r.ok) {
      setError(r.message ?? "Couldn’t save. Try again.");
      return false;
    }
    router.refresh();
    return true;
  }
  return { busy, error, run };
}

function TodayView({ data, areas, steps, focusAreaId, nextStep }: { data: DailyData; areas: Area[]; steps: Step[]; focusAreaId: string | null; nextStep: React.ReactNode }) {
  const [adding, setAdding] = useState(false);
  // What the last timer session logged: shown (with a note box) after the
  // page refreshes and the timer itself has gone.
  const [after, setAfter] = useState<{ actionId: string | null; planned: number; seconds: number; logId: string | null } | null>(null);
  const today = data.today;
  const live = data.actions.filter((a) => a.status === "active");
  const due = live.filter((a) => dueOn(a, today));
  const notToday = data.actions.filter((a) => !due.includes(a));
  const mindful = mindfulOf(data.actions, data.logs, today);

  return (
    <div className="da-grid">
      <div className="da-main">
        {welcomeBack(data.lastActive, today) ? (
          <p className="da-welcome" role="status"><b>Welcome back.</b> Start with today.</p>
        ) : null}

        {after ? (
          <AfterSession action={data.actions.find((a) => a.id === after.actionId) ?? null} planned={after.planned} logged={after} onClose={() => setAfter(null)} />
        ) : data.timer ? (
          <TimerPanel data={data} onLogged={setAfter} />
        ) : null}

        {nextStep ? (
          <section className="da-card" aria-labelledby="da-ns-h">
            <h2 id="da-ns-h">Your Next Step today</h2>
            {nextStep}
          </section>
        ) : null}

        <section className="da-card" aria-labelledby="da-actions-h">
          <div className="da-card-head">
            <h2 id="da-actions-h">Your daily actions</h2>
            {due.length ? <span className="da-small">{due.filter((a) => progressOf(a, data.logs, today).doneToday || a.measure === "run").length} of {due.length} logged today</span> : null}
          </div>
          {due.length ? (
            <ul className="da-list">
              {due.map((a) => <ActionRow key={a.id} a={a} data={data} areas={areas} steps={steps} />)}
            </ul>
          ) : (
            <p className="da-small">{data.actions.length ? "Nothing set for today." : "Add the everyday things that move your areas: the gym, meditation, a walk, a focus block. Each one links to an area of your map."}</p>
          )}
          {live.length > ACTION_ADVICE_LIMIT ? (
            <p className="da-note">You have {live.length} actions on the go. Three to five is usually enough to keep them all alive.</p>
          ) : null}
          {adding ? (
            <ActionForm areas={areas} steps={steps} focusAreaId={focusAreaId} onDone={() => setAdding(false)} />
          ) : (
            <button type="button" className="ns-add" onClick={() => setAdding(true)}>+ New daily action</button>
          )}
          {notToday.length ? (
            <details className="da-more">
              <summary>Not on today ({notToday.length})</summary>
              <ul className="da-list">
                {notToday.map((a) => <ActionRow key={a.id} a={a} data={data} areas={areas} steps={steps} quiet />)}
              </ul>
            </details>
          ) : null}
        </section>
      </div>

      <aside className="da-side">
        <CheckInCard initial={data.checkIn} />
        {mindful.weekSeconds > 0 ? (
          <section className="da-card" aria-labelledby="da-mindful-h">
            <h2 id="da-mindful-h">Mindful minutes</h2>
            <p className="da-big">{minutesOf(mindful.todaySeconds)} <span>today</span></p>
            <p className="da-small">{minutesOf(mindful.weekSeconds)} this week · {mindful.sessions} session{mindful.sessions === 1 ? "" : "s"}</p>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

// One action, one control that fits how it's measured.
function ActionRow({ a, data, areas, steps, quiet = false }: { a: DailyAction; data: DailyData; areas: Area[]; steps: Step[]; quiet?: boolean }) {
  const { busy, error, run } = useRun();
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const p = progressOf(a, data.logs, data.today);
  const area = areas.find((x) => x.id === a.life_area_id)?.name;
  const step = steps.find((x) => x.id === a.goal_id)?.title;
  const id = `da-${a.id}`;
  const status = a.status === "active" ? null : a.status === "paused" ? "Paused" : a.status === "completed" ? "Completed" : "Archived";

  return (
    <li className={`da-row${quiet ? " is-quiet" : ""}`}>
      <div className="da-row-main">
        {a.measure === "done" && !quiet ? (
          <input type="checkbox" id={id} className="da-check" checked={p.doneToday} disabled={busy} onChange={(e) => run(() => tickDailyAction(a.id, e.target.checked))} />
        ) : null}
        <div className="da-row-text">
          <label htmlFor={a.measure === "done" && !quiet ? id : undefined} className="da-name">{a.name}</label>
          <p className="da-line">{p.line}{a.measure !== "run" ? <span> · {scheduleLabel(a)}</span> : null}</p>
          <p className="da-tags">
            {area ? <span className="da-area">{area}</span> : null}
            {step ? <span className="da-tag">Next Step: {step}</span> : null}
            {a.private ? <span className="da-tag">Private</span> : <span className="da-tag">Shared with your coach</span>}
            {status ? <span className="da-tag">{status}</span> : null}
          </p>
        </div>
        <div className="da-row-ctl">
          {quiet ? null : a.measure === "count" ? (
            <>
              {p.today > 0 ? <button type="button" className="da-btn da-btn-sm" disabled={busy} aria-label={`Take one off ${a.name} today`} onClick={() => run(() => countDailyAction(a.id, -1))}>−</button> : null}
              <button type="button" className="da-btn" disabled={busy} aria-label={`Add one to ${a.name} today`} onClick={() => run(() => countDailyAction(a.id, 1))}>+1</button>
            </>
          ) : a.measure === "minutes" ? (
            <button type="button" className="da-btn" aria-expanded={logging} onClick={() => setLogging((x) => !x)}>Log minutes</button>
          ) : null}
          <button type="button" className="da-edit" aria-expanded={editing} aria-label={`Edit ${a.name}`} onClick={() => setEditing((x) => !x)}>Edit</button>
        </div>
      </div>
      {logging && a.measure === "minutes" ? <MinutesPanel a={a} timerRunning={!!data.timer} onClose={() => setLogging(false)} /> : null}
      {editing ? (
        <div className="da-edit-panel">
          {a.measure === "run" ? (
            <div className="da-run-ctl" role="group" aria-label={`${a.name}: the run`}>
              {a.run_ended ? (
                <button type="button" className="da-btn" disabled={busy} onClick={() => run(() => setRun(a.id, "restart"))}>Start a new run today</button>
              ) : a.run_paused ? (
                <button type="button" className="da-btn" disabled={busy} onClick={() => run(() => setRun(a.id, "resume"))}>Carry on</button>
              ) : (
                <button type="button" className="da-btn" disabled={busy} onClick={() => run(() => setRun(a.id, "pause"))}>Pause the run</button>
              )}
              {!a.run_ended ? <button type="button" className="da-btn" disabled={busy} onClick={() => run(() => setRun(a.id, "end"))}>End it here</button> : null}
            </div>
          ) : null}
          <ActionForm initial={a} areas={areas} steps={steps} focusAreaId={null} onDone={() => setEditing(false)} />
          <div className="da-status" role="group" aria-label={`${a.name}: status`}>
            {a.status === "active" ? <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => run(() => setDailyActionStatus(a.id, "paused"))}>Pause it</button> : null}
            {a.status !== "active" ? <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => run(() => setDailyActionStatus(a.id, "active"))}>Make it active</button> : null}
            {a.status !== "completed" ? <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => run(() => setDailyActionStatus(a.id, "completed"))}>Mark it complete</button> : null}
            <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => run(() => setDailyActionStatus(a.id, "archived"))}>Archive</button>
          </div>
        </div>
      ) : null}
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </li>
  );
}

// Minutes: the timer (5, 10, 20 or your own) or minutes added by hand.
function MinutesPanel({ a, timerRunning, onClose }: { a: DailyAction; timerRunning: boolean; onClose: () => void }) {
  const { busy, error, run } = useRun();
  const presets = [5, 10, 20];
  const [minutes, setMinutes] = useState(a.period === "day" && a.target && a.target <= 180 ? a.target : 10);
  const [intention, setIntention] = useState("");
  const [manual, setManual] = useState("");
  return (
    <div className="da-minutes">
      <div className="da-minutes-timer">
        <p className="da-k">Timer</p>
        {timerRunning ? (
          <p className="da-small">A timer is already running above. Finish or cancel it first.</p>
        ) : (
          <>
            <div className="da-presets" role="group" aria-label="How long">
              {presets.map((m) => (
                <button key={m} type="button" className="da-btn" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>
              ))}
              <label className="da-custom">
                <span className="sr-only">Your own length, in minutes</span>
                <input type="number" min={1} max={180} inputMode="numeric" value={presets.includes(minutes) ? "" : minutes} placeholder="Other" onChange={(e) => setMinutes(Math.max(1, Math.min(180, Number(e.target.value) || 1)))} />
              </label>
            </div>
            <label className="da-field">
              <span>Intention <span className="da-small">(optional)</span></span>
              <input type="text" maxLength={200} value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="Breathe and let today settle" />
            </label>
            <button type="button" className="btn btn-p" disabled={busy} onClick={async () => { if (await run(() => startTimer(a.id, minutes, intention))) onClose(); }}>
              Start {minutes} minutes
            </button>
          </>
        )}
      </div>
      <div className="da-minutes-manual">
        <p className="da-k">Or add minutes</p>
        <div className="da-inline">
          <label className="sr-only" htmlFor={`da-m-${a.id}`}>Minutes to add</label>
          <input id={`da-m-${a.id}`} type="number" min={1} max={600} inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="Minutes" />
          <button type="button" className="da-btn" disabled={busy || !manual} onClick={async () => { if (await run(() => addDailyMinutes(a.id, Number(manual)))) { setManual(""); onClose(); } }}>Add</button>
        </div>
      </div>
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </div>
  );
}

// The running timer: worked out from its stored start, so a refresh, a
// sleeping phone or a background tab doesn't lose a second. Only its state
// changes are announced, never each second.
function TimerPanel({ data, onLogged }: { data: DailyData; onLogged: (x: { actionId: string | null; planned: number; seconds: number; logId: string | null }) => void }) {
  const t = data.timer!;
  const action = data.actions.find((a) => a.id === t.action_id) ?? null;
  const { busy, error, run } = useRun();
  // The server's clock less the device's, measured when the page loaded.
  const [offset] = useState(() => data.serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  // "Started." for a session just begun; nothing on coming back to one.
  const [announce, setAnnounce] = useState(() => (!t.paused_at && Date.now() + offset - Date.parse(t.started_at) < 10_000 ? "Started." : ""));
  const s = timerState(t, now);
  const wasFinished = useRef(s.finished);

  useEffect(() => {
    if (s.paused) return;
    const id = window.setInterval(() => setNow(Date.now() + offset), 500);
    const wake = () => setNow(Date.now() + offset);
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [s.paused, offset]);

  useEffect(() => {
    if (s.finished && !wasFinished.current) {
      setAnnounce("Complete.");
      chime();
    }
    wasFinished.current = s.finished;
  }, [s.finished]);

  return (
    <section className="da-card da-timer" aria-labelledby="da-timer-h">
      <p className="sr-only" aria-live="polite">{announce}</p>
      <div className="da-card-head">
        <h2 id="da-timer-h">{action?.name ?? "Mindful minutes"}</h2>
        <span className="da-small">{s.finished ? "Complete" : s.paused ? "Paused" : "Running"}</span>
      </div>
      {t.intention ? <p className="da-why"><em>{t.intention}</em></p> : null}
      <p className="da-clock" aria-hidden="true">{clock(s.finished ? 0 : s.remaining)}</p>
      <p className="sr-only">{minutesOf(s.elapsed)} of {minutesOf(t.planned_seconds)} minutes done.</p>
      <div className="da-timer-ctl">
        {s.finished ? null : s.paused ? (
          <button type="button" className="da-btn" disabled={busy} onClick={async () => { if (await run(() => pauseTimer(false))) setAnnounce("Resumed."); }}>Resume</button>
        ) : (
          <button type="button" className="da-btn" disabled={busy} onClick={async () => { if (await run(() => pauseTimer(true))) setAnnounce("Paused."); }}>Pause</button>
        )}
        <button
          type="button"
          className="btn btn-p"
          disabled={busy}
          onClick={async () => {
            const r = await finishTimer();
            if (r.ok) onLogged({ actionId: t.action_id, planned: t.planned_seconds, seconds: r.seconds, logId: r.logId });
            else await run(async () => r);
          }}
        >
          {s.finished ? "Log it" : "Finish and log"}
        </button>
        <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => { if (window.confirm("Cancel this session? Nothing will be logged.")) void run(() => cancelTimer()); }}>Cancel</button>
      </div>
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </section>
  );
}

// After a session: what was logged (the actual time), and a short note if
// they want one, kept in the journal.
function AfterSession({ action, planned, logged, onClose }: { action: DailyAction | null; planned: number; logged: { seconds: number; logId: string | null }; onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const mins = minutesOf(logged.seconds);
  const done = () => {
    onClose();
    router.refresh();
  };
  return (
    <section className="da-card da-timer" aria-labelledby="da-after-h">
      <h2 id="da-after-h" role="status">
        {logged.seconds < 60 ? "Less than a minute, so nothing was logged." : `${mins} minute${mins === 1 ? "" : "s"} logged${logged.seconds < planned ? ` of ${minutesOf(planned)}` : ""}.`}
      </h2>
      {action && logged.seconds >= 60 ? (
        <>
          <label className="da-field">
            <span>A short note? <span className="da-small">(optional, kept in your journal)</span></span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you noticed" />
          </label>
          <div className="da-inline">
            <button type="button" className="da-btn" disabled={busy || !note.trim()} onClick={async () => { setBusy(true); await noteOnAction(action.id, note, logged.logId); done(); }}>Save note</button>
            <button type="button" className="au-text-link as-btn" onClick={done}>Done</button>
          </div>
        </>
      ) : (
        <button type="button" className="au-text-link as-btn" onClick={done}>Done</button>
      )}
    </section>
  );
}

// A gentle sound and a buzz when a session completes, where the browser
// allows it. No notification permission needed.
function chime() {
  try {
    navigator.vibrate?.(200);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 528;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.6);
  } catch {
    // Sound is a nicety; the page says Complete either way.
  }
}

// Add or change an action.
function ActionForm({ initial, areas, steps, focusAreaId, onDone }: { initial?: DailyAction; areas: Area[]; steps: Step[]; focusAreaId: string | null; onDone: () => void }) {
  const { busy, error, run } = useRun();
  const [name, setName] = useState(initial?.name ?? "");
  const [measure, setMeasure] = useState<Measure>(initial?.measure ?? "done");
  const [target, setTarget] = useState(initial?.target ? String(initial.target) : "");
  const [period, setPeriod] = useState<Period>(initial?.period ?? "week");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [areaId, setAreaId] = useState(initial ? initial.life_area_id ?? "" : focusAreaId ?? "");
  const [goalId, setGoalId] = useState(initial?.goal_id ?? "");
  const [days, setDays] = useState<number[]>(initial?.days ?? []);
  const [time, setTime] = useState(initial?.at_time?.slice(0, 5) ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [mindful, setMindful] = useState(initial?.mindful ?? false);
  const [mindfulTouched, setMindfulTouched] = useState(!!initial);
  const [isPrivate, setIsPrivate] = useState(initial?.private ?? true);
  const uid = initial?.id ?? "new";
  const showMindful = measure === "minutes";
  const mindfulNow = mindfulTouched ? mindful : looksMindful(name);

  async function save() {
    const input: ActionInput = {
      id: initial?.id, name, measure, target: target ? Number(target) : null, period, unit, lifeAreaId: areaId || null, goalId: goalId || null,
      days, atTime: time || null, startDate: startDate || null, endDate: endDate || null, mindful: showMindful && mindfulNow, private: isPrivate,
    };
    if (await run(() => saveDailyAction(input))) onDone();
  }

  const targetWord = measure === "minutes" ? "minutes" : measure === "count" ? unit.trim() || "times" : "times";
  return (
    <form className="da-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label className="da-field">
        <span>What is it?</span>
        <input type="text" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Gym, meditation, a walk, a focus block" />
      </label>
      <fieldset className="da-field">
        <legend>How you&rsquo;ll measure it</legend>
        <div className="da-measures">
          {MEASURES.map((m) => (
            <label key={m.key} className={measure === m.key ? "is-on" : undefined}>
              <input type="radio" name={`measure-${uid}`} value={m.key} checked={measure === m.key} onChange={() => { setMeasure(m.key); if (m.key === "run") setIsPrivate(true); }} />
              <b>{m.label}</b>
              <span>{m.help}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {measure !== "run" ? (
        <div className="da-field">
          <span id={`da-target-${uid}`}>Target <span className="da-small">(optional)</span></span>
          <div className="da-inline" role="group" aria-labelledby={`da-target-${uid}`}>
            <input type="number" min={1} max={100000} inputMode="numeric" aria-label="How many" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="4" className="da-num" />
            {measure === "count" ? <input type="text" maxLength={30} aria-label="Of what" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="visits" className="da-unit" /> : <span>{targetWord}</span>}
            <select aria-label="Per" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              <option value="day">a day</option>
              <option value="week">a week</option>
              <option value="month">a month</option>
            </select>
          </div>
        </div>
      ) : null}
      <div className="da-two">
        <label className="da-field">
          <span>Area of your map</span>
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Choose an area</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        {steps.length ? (
          <label className="da-field">
            <span>Part of a Next Step? <span className="da-small">(optional)</span></span>
            <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">No</option>
              {steps.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {measure !== "run" ? (
        <div className="da-field">
          <span id={`da-days-${uid}`}>Which days <span className="da-small">(none ticked: any day)</span></span>
          <div className="da-inline" role="group" aria-labelledby={`da-days-${uid}`}>
            <span className="when-days">
              {["M", "T", "W", "T", "F", "S", "S"].map((l, d) => (
                <button key={d} type="button" aria-pressed={days.includes(d)} aria-label={DAY_NAMES[d]} onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>{l}</button>
              ))}
            </span>
            <label className="when-field"><span>at</span><input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} /></label>
          </div>
        </div>
      ) : null}
      <div className="da-two">
        <label className="da-field">
          <span>{measure === "run" ? "Run started" : "Starts"}</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        {measure !== "run" ? (
          <label className="da-field">
            <span>Ends <span className="da-small">(optional)</span></span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        ) : null}
      </div>
      {showMindful ? (
        <label className="da-check-row">
          <input type="checkbox" checked={mindfulNow} onChange={(e) => { setMindfulTouched(true); setMindful(e.target.checked); }} />
          <span>Count it as mindful minutes</span>
        </label>
      ) : null}
      <label className="da-check-row">
        <input type="checkbox" checked={!isPrivate} onChange={(e) => setIsPrivate(!e.target.checked)} />
        <span>Share it with my coach <span className="da-small">(otherwise it&rsquo;s private)</span></span>
      </label>
      <div className="da-inline">
        <button type="submit" className="btn btn-p" disabled={busy || !name.trim()}>{busy ? "Saving…" : initial ? "Save changes" : "Add it"}</button>
        <button type="button" className="au-text-link as-btn" disabled={busy} onClick={onDone}>Cancel</button>
      </div>
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </form>
  );
}

// How aligned today, 1–5 (the only part needed), and one thing to remember,
// which goes into the journal.
function CheckInCard({ initial }: { initial: { rating: number; note: string } | null }) {
  const { busy, error, run } = useRun();
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [saved, setSaved] = useState(!!initial);
  return (
    <section className="da-card" aria-labelledby="da-checkin-h">
      <h2 id="da-checkin-h">Check in</h2>
      <fieldset className="da-rating">
        <legend>How aligned do you feel today?</legend>
        <div>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={rating === n ? "is-on" : undefined}>
              <input type="radio" name="da-rating" value={n} checked={rating === n} onChange={() => { setRating(n); setSaved(false); }} />
              <span>{n}</span>
            </label>
          ))}
        </div>
        <p className="da-scale"><span>Not at all</span><span>Fully</span></p>
      </fieldset>
      <label className="da-field">
        <span>What do you want to remember? <span className="da-small">(optional)</span></span>
        <textarea rows={3} value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} placeholder="A thought, a win, or what got in the way" />
      </label>
      <button type="button" className="btn btn-p da-wide" disabled={busy || rating === null || saved} onClick={async () => { if (await run(() => saveCheckIn(rating!, note))) setSaved(true); }}>
        {busy ? "Saving…" : saved ? "Saved for today" : "Save today’s check-in"}
      </button>
      {saved && note.trim() ? <p className="da-small">In your <Link href="/journal" className="au-text-link">journal</Link>.</p> : null}
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </section>
  );
}

// The week, as evidence: no score, no red days.
function WeekView({ data, areas }: { data: DailyData; areas: Area[] }) {
  const today = data.today;
  const strip = useMemo(() => weekStrip(data.actions, data.logs, today), [data, today]);
  const mindful = mindfulOf(data.actions, data.logs, today);
  const shown = data.actions.filter((a) => a.status !== "archived");
  const runs = shown.filter((a) => a.measure === "run" && a.run_started);
  const others = shown.filter((a) => a.measure !== "run");
  // In the week: a daily target ("10 minutes a day") isn't a weekly one, so it's shown as the week's total.
  const weekView = (a: DailyAction) =>
    progressOf({ ...a, period: a.period === "month" ? "month" : "week", target: a.period === "day" ? null : a.target }, data.logs, today).line.replace(/^\d+ minutes today · /, "");
  const logged = strip.reduce((s, d) => s + d.done, 0);
  const planned = strip.reduce((s, d) => s + d.planned, 0);
  return (
    <div className="da-week">
      <section className="da-card" aria-labelledby="da-strip-h">
        <div className="da-card-head">
          <h2 id="da-strip-h">This week</h2>
          {planned ? <span className="da-small">{logged} logged · {planned} set for particular days</span> : null}
        </div>
        <ol className="da-strip">
          {strip.map((d) => (
            <li key={d.date} className={`${d.today ? "is-today" : ""}${d.done ? " has-done" : ""}`}>
              <span className="da-strip-l">{d.letter}</span>
              <span aria-hidden="true">{d.future && !d.done ? "–" : d.done || "–"}</span>
              {d.planned ? <span className="da-strip-set" aria-hidden="true">{d.planned} set</span> : null}
              <span className="sr-only">{d.date}: {d.done} logged{d.planned ? `, ${d.planned} set for the day` : ""}</span>
            </li>
          ))}
        </ol>
      </section>

      {others.length ? (
        <section className="da-card" aria-labelledby="da-evidence-h">
          <h2 id="da-evidence-h">Your actions</h2>
          <ul className="da-evidence">
            {others.map((a) => (
              <li key={a.id}>
                <b>{a.name}</b>
                <span>{weekView(a)}</span>
                <span className="da-area">{areas.find((x) => x.id === a.life_area_id)?.name ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="da-two">
        <section className="da-card" aria-labelledby="da-wmindful-h">
          <h2 id="da-wmindful-h">Mindful minutes</h2>
          <p className="da-big">{minutesOf(mindful.weekSeconds)} <span>this week</span></p>
          <p className="da-small">
            {mindful.sessions} session{mindful.sessions === 1 ? "" : "s"}
            {mindful.averageSeconds ? ` · about ${Math.max(1, minutesOf(mindful.averageSeconds))} minutes each` : ""}
          </p>
        </section>
        {runs.length ? (
          <section className="da-card" aria-labelledby="da-runs-h">
            <h2 id="da-runs-h">Current runs</h2>
            <ul className="da-evidence">
              {runs.map((a) => <li key={a.id}><b>{a.name}</b><span>{progressOf(a, data.logs, today).line}</span>{a.private ? <span className="da-tag">Private</span> : null}</li>)}
            </ul>
          </section>
        ) : null}
      </div>

      <section className="da-card" aria-labelledby="da-wjournal-h">
        <h2 id="da-wjournal-h">This week&rsquo;s check-ins and notes</h2>
        {data.weekCheckIns.length ? (
          <p className="da-small">Check-ins: {[...data.weekCheckIns].reverse().map((c) => `${shortDay(c.date)} ${c.rating}/5`).join(" · ")}</p>
        ) : null}
        {data.weekNotes.length ? (
          <ul className="da-notes">
            {data.weekNotes.map((n) => <li key={n.id}><span className="da-small">{shortDay(n.date)}</span> {n.text}</li>)}
          </ul>
        ) : (
          <p className="da-small">No journal notes yet this week.</p>
        )}
        <p><Link href="/journal" className="au-text-link">Open your journal →</Link> · <Link href="/next-step" className="au-text-link">Your Next Step and weekly check-in →</Link></p>
      </section>
    </div>
  );
}

const shortDay = (ymd: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(new Date(`${ymd}T12:00:00Z`));
