"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { isAlignmentDate, isAlignmentTimeZone, localDate } from "@/lib/alignment";
import type { AlignmentDaily, AlignmentWeekly, AlignmentScore, DailyAlignmentInput, WeeklyAlignmentInput } from "@/lib/alignment";

export type AlignmentData = {
  available: boolean;
  daily: AlignmentDaily | null;
  days: AlignmentDaily[];
  weekly: AlignmentWeekly | null;
  date: string;
  week_start: string;
  timezone: string;
  goals: { id: string; goal_title: string | null }[];
};
type Result<T> = { ok: true; entry: T } | { ok: false; message: string };
type SimpleResult = { ok: true } | { ok: false; message: string };
export type AlignmentService = {
  read: (input: { date: string; timezone: string }) => Promise<AlignmentData>;
  saveDaily: (input: DailyAlignmentInput) => Promise<Result<AlignmentDaily>>;
  saveWeekly: (input: WeeklyAlignmentInput) => Promise<Result<AlignmentWeekly>>;
  deleteDaily: (date: string) => Promise<SimpleResult>;
  deleteWeekly: (date: string) => Promise<SimpleResult>;
  exportData: () => Promise<{ ok: true; data: unknown } | { ok: false; message: string }>;
};
type View = "today" | "week" | "privacy";
type ScoreField = "wellbeing" | "meaningful_action" | "participation" | "values_choice";

const QUESTIONS: { key: ScoreField; title: string; short: string }[] = [
  { key: "wellbeing", title: "Did I care for my wellbeing?", short: "Wellbeing" },
  { key: "meaningful_action", title: "Did I take one meaningful action?", short: "Meaningful action" },
  { key: "participation", title: "Did I participate in life?", short: "Participation in life" },
  { key: "values_choice", title: "When challenged, did I choose a response that reflected my values?", short: "Conscious choice" },
];
const SCORE_CHOICES: { value: AlignmentScore | null; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partly", label: "Partly" },
  { value: "not_today", label: "Not today" },
  { value: null, label: "Leave blank" },
];

// Dates are deliberately built from the browser's calendar, never a UTC slice.
export function browserDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function shiftDay(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  return browserDay(new Date(year, month - 1, day + amount, 12));
}
function monday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day, 12).getDay();
  return shiftDay(date, -(weekday === 0 ? 6 : weekday - 1));
}
function dateLabel(date: string, full = false) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", ...(full ? { weekday: "long" } : {}), year: "numeric" }).format(new Date(year, month - 1, day, 12));
}
function blankDay(date: string, timezone: string): DailyAlignmentInput {
  return { entry_date: date, timezone, presence_done: null, priority: null, goal_id: null, value: null, wellbeing_action: null, evening_note: null, wellbeing: null, meaningful_action: null, participation: null, values_choice: null };
}
function blankWeek(date: string, timezone: string): WeeklyAlignmentInput {
  return { week_start: date, timezone, helped: null, adjustment: null, next_priority: null };
}
function dailyInput(entry: AlignmentDaily): DailyAlignmentInput {
  return { entry_date: entry.entry_date, timezone: entry.timezone, presence_done: entry.presence_done, priority: entry.priority, goal_id: entry.goal_id, value: entry.value, wellbeing_action: entry.wellbeing_action, evening_note: entry.evening_note, wellbeing: entry.wellbeing, meaningful_action: entry.meaningful_action, participation: entry.participation, values_choice: entry.values_choice };
}
function weeklyInput(entry: AlignmentWeekly): WeeklyAlignmentInput {
  return { week_start: entry.week_start, timezone: entry.timezone, helped: entry.helped, adjustment: entry.adjustment, next_priority: entry.next_priority };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const nullable = (value: string) => value || null;

export function AlignmentWorkspace({ service, preview = false, initialDate, initialTimezone, initialView = "today" }: { service: AlignmentService; preview?: boolean; initialDate?: string; initialTimezone?: string; initialView?: View }) {
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [view, setView] = useState<View>(initialView);
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [timezoneSource, setTimezoneSource] = useState<"profile" | "device" | "utc">("utc");
  const [data, setData] = useState<AlignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failure, setFailure] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DailyAlignmentInput>>({});
  const [weekDrafts, setWeekDrafts] = useState<Record<string, WeeklyAlignmentInput>>({});
  const [baselines, setBaselines] = useState<Record<string, DailyAlignmentInput>>({});
  const [weekBaselines, setWeekBaselines] = useState<Record<string, WeeklyAlignmentInput>>({});
  const [savedDays, setSavedDays] = useState<Record<string, AlignmentDaily>>({});
  const [savedWeeks, setSavedWeeks] = useState<Record<string, AlignmentWeekly>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<"day" | "week" | null>(null);
  const week = date ? monday(date) : "";
  const daily = drafts[date] ?? blankDay(date, timezone);
  const weekly = weekDrafts[week] ?? blankWeek(week, timezone);
  const dirty = !same(daily, baselines[date] ?? blankDay(date, timezone));
  const weekDirty = !same(weekly, weekBaselines[week] ?? blankWeek(week, timezone));
  const anyDirty = Object.entries(drafts).some(([key, value]) => !same(value, baselines[key] ?? blankDay(key, value.timezone))) || Object.entries(weekDrafts).some(([key, value]) => !same(value, weekBaselines[key] ?? blankWeek(key, value.timezone)));
  const unavailable = data?.available === false;
  const disabled = loading || busy;
  const weekDays = week ? Object.values(savedDays).filter((entry) => entry.entry_date >= week && entry.entry_date <= shiftDay(week, 6)).sort((a, b) => a.entry_date.localeCompare(b.entry_date)) : [];

  useEffect(() => {
    let deviceTimezone: string | undefined;
    try { deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* UTC remains the safe fallback. */ }
    const savedZone = isAlignmentTimeZone(initialTimezone) ? initialTimezone : null;
    const deviceZone = isAlignmentTimeZone(deviceTimezone) ? deviceTimezone : null;
    const zone = savedZone ?? deviceZone ?? "UTC";
    const local = localDate(zone);
    const requested = isAlignmentDate(initialDate) && initialDate <= local ? initialDate : local;
    setToday(local);
    setDate(requested);
    setTimezone(zone);
    setTimezoneSource(savedZone ? "profile" : deviceZone ? "device" : "utc");
  }, [initialDate, initialTimezone]);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setStatus("");
    setDeleteConfirm(null);
    service.read({ date, timezone }).then((result) => {
      if (cancelled) return;
      setData(result);
      const dayInputs: Record<string, DailyAlignmentInput> = { [date]: blankDay(date, timezone) };
      const entries: Record<string, AlignmentDaily> = {};
      for (const entry of [...result.days, ...(result.daily ? [result.daily] : [])]) {
        dayInputs[entry.entry_date] = dailyInput(entry);
        entries[entry.entry_date] = entry;
      }
      setDrafts((current) => ({ ...dayInputs, ...current }));
      setBaselines((current) => ({ ...dayInputs, ...current }));
      setSavedDays((current) => ({ ...current, ...entries }));
      const weekInput = result.weekly ? weeklyInput(result.weekly) : blankWeek(result.week_start, timezone);
      setWeekDrafts((current) => ({ [result.week_start]: weekInput, ...current }));
      setWeekBaselines((current) => ({ [result.week_start]: weekInput, ...current }));
      if (result.weekly) setSavedWeeks((current) => ({ ...current, [result.week_start]: result.weekly! }));
    }).catch(() => {
      if (!cancelled) setLoadError("Your saved alignment could not be loaded. Retry before editing, so an existing entry is kept safe.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, timezone, service, reload]);

  useEffect(() => {
    if (!anyDirty || preview) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const protectLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.hasAttribute("download") || (target.target && target.target !== "_self")) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin || (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
      if (!window.confirm("You have unsaved alignment changes. Leave this page and discard those drafts?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", protectLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", protectLink, true);
    };
  }, [anyDirty, preview]);

  function updateDay(patch: Partial<DailyAlignmentInput>) {
    setDrafts((current) => ({ ...current, [date]: { ...(current[date] ?? blankDay(date, timezone)), ...patch } }));
    setStatus("");
    setDeleteConfirm(null);
  }
  function updateWeek(patch: Partial<WeeklyAlignmentInput>) {
    setWeekDrafts((current) => ({ ...current, [week]: { ...(current[week] ?? blankWeek(week, timezone)), ...patch } }));
    setStatus("");
    setDeleteConfirm(null);
  }
  async function save(kind: "day" | "week") {
    setBusy(true);
    setFailure(false);
    setStatus("");
    try {
      if (kind === "day") {
        const result = await service.saveDaily(daily);
        if (!result.ok) { setFailure(true); setStatus(result.message); return; }
        const input = dailyInput(result.entry);
        setDrafts((current) => ({ ...current, [date]: input }));
        setBaselines((current) => ({ ...current, [date]: input }));
        setSavedDays((current) => ({ ...current, [date]: result.entry }));
      } else {
        const result = await service.saveWeekly(weekly);
        if (!result.ok) { setFailure(true); setStatus(result.message); return; }
        const input = weeklyInput(result.entry);
        setWeekDrafts((current) => ({ ...current, [week]: input }));
        setWeekBaselines((current) => ({ ...current, [week]: input }));
        setSavedWeeks((current) => ({ ...current, [week]: result.entry }));
      }
      setStatus(preview ? "Preview updated for this session. Nothing has been saved." : "Saved privately. You can come back and edit this entry.");
    } catch {
      setFailure(true);
      setStatus("This could not be saved. Your draft is still here. Please try again.");
    } finally { setBusy(false); }
  }
  async function remove(kind: "day" | "week") {
    setBusy(true);
    setFailure(false);
    try {
      const result = await (kind === "day" ? service.deleteDaily(date) : service.deleteWeekly(week));
      if (!result.ok) { setFailure(true); setStatus(result.message); return; }
      if (kind === "day") {
        const blank = blankDay(date, timezone);
        setDrafts((current) => ({ ...current, [date]: blank }));
        setBaselines((current) => ({ ...current, [date]: blank }));
        setSavedDays((current) => { const next = { ...current }; delete next[date]; return next; });
      } else {
        const blank = blankWeek(week, timezone);
        setWeekDrafts((current) => ({ ...current, [week]: blank }));
        setWeekBaselines((current) => ({ ...current, [week]: blank }));
        setSavedWeeks((current) => { const next = { ...current }; delete next[week]; return next; });
      }
      setDeleteConfirm(null);
      setStatus(preview ? "Example removed from this preview session." : kind === "day" ? "This daily entry has been deleted." : "This weekly review has been deleted. Daily entries are still available.");
    } catch { setFailure(true); setStatus("This could not be deleted. Please try again."); }
    finally { setBusy(false); }
  }
  async function exportData() {
    setBusy(true);
    setFailure(false);
    try {
      const result = await service.exportData();
      if (!result.ok) { setFailure(true); setStatus(result.message); return; }
      const url = URL.createObjectURL(new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${preview ? "fictional-" : ""}aligned-alignment-${today}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(preview ? "Fictional preview data exported. No personal data was used." : "Your saved alignment has been exported. Unsaved drafts are not included. Keep the downloaded file somewhere private.");
    } catch { setFailure(true); setStatus("Your export could not be prepared. Please try again."); }
    finally { setBusy(false); }
  }
  function changeView(next: View) { setView(next); setDeleteConfirm(null); }
  function changeDate(next: string) {
    if (isAlignmentDate(next) && next <= today) setDate(next);
  }

  return (
    <>
      <div className="topbar"><Link href="/" className="tb-back">← My profile</Link><span className="tb-label">Your daily practice</span></div>
      <main className="page alignment-page">
        {preview ? <div className="alignment-preview-banner" role="note">Design preview · fictional data · nothing saved</div> : null}
        <header className="alignment-head">
          <div className="eyebrow"><span className="eydot" /> The Aligned Protocol</div>
          <h1>Daily alignment</h1>
          <p className="alignment-lede">A moment to arrive. One meaningful step. A little space to reflect.</p>
          <p className="alignment-help">You can begin before everything feels resolved.</p>
        </header>
        <div className="alignment-tabs" role="tablist" aria-label="Alignment views">
          {([{ key: "today", label: "Today" }, { key: "week", label: "Weekly review" }, { key: "privacy", label: "Privacy & history" }] as const).map((tab, index, all) => (
            <button key={tab.key} ref={(node) => { tabs.current[index] = node; }} type="button" role="tab" id={`${id}-tab-${tab.key}`} aria-controls={`${id}-panel-${tab.key}`} aria-selected={view === tab.key} tabIndex={view === tab.key ? 0 : -1} onClick={() => changeView(tab.key)} onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % all.length;
              else if (event.key === "ArrowLeft") next = (index + all.length - 1) % all.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = all.length - 1;
              else return;
              event.preventDefault(); changeView(all[next].key); tabs.current[next]?.focus();
            }}>{tab.label}</button>
          ))}
        </div>
        <div className="alignment-date">
          <div><p className="alignment-kicker">{view === "week" ? "Your week" : date === today ? "Today" : "Your chosen day"}</p><strong>{date ? view === "week" ? `${dateLabel(week)} – ${dateLabel(shiftDay(week, 6))}` : dateLabel(date, true) : "Finding your local day…"}</strong></div>
          <div><label htmlFor={`${id}-date`} className="alignment-small">{view === "week" ? "Choose a day in the week" : "Choose a day"}</label><input className="alignment-field" id={`${id}-date`} type="date" value={date} max={today} disabled={busy || !today} onChange={(event) => changeDate(event.target.value)} /></div>
        </div>
        {date ? <p className="alignment-small">Dates use {timezone.replaceAll("_", " ")}{timezoneSource === "device" ? " (your device timezone)" : timezoneSource === "utc" ? " (UTC fallback)" : ""}. {!preview ? <><Link href="/details">{timezoneSource === "profile" ? "Change in Your details" : "Set a timezone in Your details"}</Link>. </> : null}{date !== today ? <button className="alignment-secondary" type="button" disabled={busy} onClick={() => changeDate(today)}>Back to today</button> : null}</p> : null}
        {loading ? <p className="alignment-notice" role="status">Opening your alignment…</p> : null}
        {loadError ? <div className="alignment-notice" role="alert"><p>{loadError}</p><button className="btn btn-g" type="button" onClick={() => setReload((value) => value + 1)}>Retry</button></div> : null}
        {unavailable ? <div className="alignment-notice" role="note">Private saving is not available yet. You can use the practices below; entries will stay in this page only and disappear when you leave.</div> : null}

        {!loadError ? <>
          <section role="tabpanel" id={`${id}-panel-today`} aria-labelledby={`${id}-tab-today`} hidden={view !== "today"} className="alignment-stack">
            <section className="alignment-card" aria-labelledby={`${id}-morning`}>
              <div className="alignment-card-head"><span className="alignment-number" aria-hidden="true">01</span><div><p className="alignment-kicker">Morning · a few minutes</p><h2 id={`${id}-morning`}>Arrive, then choose.</h2></div></div>
              <details className="alignment-pause"><summary>Make a little room for presence <span className="alignment-small">About 5 minutes</span></summary><div className="alignment-pause-steps"><p>Feel your feet on the floor. Notice three things you can see. Let your breathing find its own rhythm.</p><p>Notice what is here: a thought, a feeling, a sensation. You do not have to solve it to begin your day.</p><p>Ask: <em>What matters to me in how I show up today?</em> Take the time that helps. There is no timer to complete.</p></div></details>
              <label className="alignment-check"><input type="checkbox" checked={daily.presence_done === true} disabled={disabled} onChange={(event) => updateDay({ presence_done: event.target.checked ? true : null })} /><span>I took a moment to arrive <span className="alignment-small">Optional</span></span></label>
              <label className="alignment-label" htmlFor={`${id}-priority`}>One meaningful priority</label>
              <p className="alignment-help">What is one small action that would make today feel well spent?</p>
              <input className="alignment-field" id={`${id}-priority`} maxLength={500} placeholder="For example, finish the outline and send it." value={daily.priority ?? ""} disabled={disabled} onChange={(event) => updateDay({ priority: nullable(event.target.value), goal_id: null })} />
              {data?.goals[0]?.goal_title ? <div className="alignment-goal"><p className="alignment-small">From My plan: {data.goals[0].goal_title}</p><button className="alignment-secondary" type="button" disabled={disabled} onClick={() => updateDay({ priority: data.goals[0].goal_title, goal_id: data.goals[0].id })}>Use this goal as my starting point</button><span className="alignment-small">You can make it smaller. Your plan stays as it is.</span></div> : <p className="alignment-small">This can be part of <Link href="/clear">My plan</Link>, or something that simply matters today.</p>}
              <div className="alignment-two">
                <div><label className="alignment-label" htmlFor={`${id}-value`}>A value to practise</label><p className="alignment-help">How do you want to show up?</p><input className="alignment-field" id={`${id}-value`} maxLength={80} placeholder="For example, courage or kindness" value={daily.value ?? ""} disabled={disabled} onChange={(event) => updateDay({ value: nullable(event.target.value) })} /></div>
                <div><label className="alignment-label" htmlFor={`${id}-wellbeing`}>One act of care</label><p className="alignment-help">Something kind and realistic for you.</p><input className="alignment-field" id={`${id}-wellbeing`} maxLength={300} placeholder="For example, walk outside after lunch" value={daily.wellbeing_action ?? ""} disabled={disabled} onChange={(event) => updateDay({ wellbeing_action: nullable(event.target.value) })} /></div>
              </div>
            </section>

            <details className="alignment-pause alignment-card"><summary><span>When an urge or difficult feeling shows up</span><span className="alignment-small">A brief pause</span></summary><div className="alignment-pause-steps"><ol><li><strong>Notice.</strong> “I am noticing an urge / the thought that…” Feel your feet and take one comfortable breath.</li><li><strong>Allow.</strong> Make room for the feeling for a moment. It can be here without giving the instruction.</li><li><strong>Choose.</strong> Ask: “What response fits {daily.value ? `my value of ${daily.value}` : "what matters to me"}?”</li><li><strong>Act.</strong> Take the smallest helpful next step. Change your surroundings or ask someone you trust for support if that helps.</li></ol><p className="alignment-help">You do not need to record the urge or describe what happened. This practice saves nothing.</p></div></details>

            <details className="alignment-card alignment-evening">
              <summary><span className="alignment-card-head"><span className="alignment-number" aria-hidden="true">02</span><span><span className="alignment-kicker">Evening · about 2 minutes</span><span className="alignment-section-title">Notice what happened.</span></span></span><span className="alignment-small">Open your four questions</span></summary>
              <p className="alignment-help">Four gentle questions. Answer what is useful and leave the rest blank. These are reflections, not a grade.</p>
              {QUESTIONS.map((question) => <fieldset key={question.key} className="alignment-score-row" disabled={disabled}><legend>{question.title}</legend><div className="alignment-options">{[...SCORE_CHOICES.slice(0, 3), ...(question.key === "values_choice" ? [{ value: "not_needed" as const, label: "No challenge arose" }] : []), SCORE_CHOICES[3]].map((choice) => <label key={choice.value ?? "blank"} className="alignment-option"><input type="radio" name={`${id}-${question.key}`} value={choice.value ?? ""} checked={daily[question.key] === choice.value} onChange={() => updateDay({ [question.key]: choice.value })} /><span>{choice.label}</span></label>)}</div></fieldset>)}
              <label className="alignment-label" htmlFor={`${id}-reflection`}>One thing I want to remember <span className="alignment-small">Optional</span></label>
              <textarea className="alignment-field" id={`${id}-reflection`} rows={3} maxLength={1000} placeholder="A moment, a lesson, or a small adjustment." value={daily.evening_note ?? ""} disabled={disabled} onChange={(event) => updateDay({ evening_note: nullable(event.target.value) })} />
            </details>
            <div className="alignment-form-footer"><div><p className="alignment-small">{preview ? "This preview uses fictional entries and keeps changes in memory only." : "All fields are optional. Nothing is recorded until you choose Save privately."}</p><p className="alignment-small">{dirty ? "Draft changes · kept here while you switch views." : savedDays[date] ? preview ? "Fictional example for this day." : "You have a saved entry for this day." : "Start wherever you are. You do not need to catch up."}</p></div><button className="btn btn-p" type="button" disabled={disabled || unavailable || !dirty} onClick={() => save("day")}>{busy ? "Working…" : preview ? "Update preview" : "Save privately"}</button></div>
          </section>

          <section role="tabpanel" id={`${id}-panel-week`} aria-labelledby={`${id}-tab-week`} hidden={view !== "week"} className="alignment-stack">
            <div className="alignment-inline"><button className="alignment-secondary" type="button" disabled={disabled} onClick={() => changeDate(shiftDay(week, -7))}>← Previous week</button><button className="alignment-secondary" type="button" disabled={disabled || week >= monday(today || browserDay())} onClick={() => changeDate(shiftDay(week, 7))}>Next week →</button></div>
            <section className="alignment-card" aria-labelledby={`${id}-patterns`}><p className="alignment-kicker">Your week, without a grade</p><h2 id={`${id}-patterns`}>Look for what helps.</h2><p className="alignment-help">These counts use {preview ? "fictional entries" : "saved answers"} for the seven days shown. Blank answers stay blank. There is no overall score.</p>
              {weekDays.length === 0 ? <p className="alignment-empty">No saved daily entries in this week. You can still reflect below. There is nothing to make up.</p> : null}
              <div className="alignment-week-grid">{QUESTIONS.map((question) => {
                const responses = weekDays.map((entry) => entry[question.key]);
                const answered = responses.filter((value) => value === "yes" || value === "partly" || value === "not_today");
                const noChallenge = responses.filter((value) => value === "not_needed").length;
                return <div className="alignment-week-row" key={question.key}><h3>{question.short}</h3>{answered.length ? <><p><strong>{answered.filter((value) => value === "yes").length} of {answered.length}</strong> answered {answered.length === 1 ? "day" : "days"}: yes</p><p className="alignment-small">Partly: {answered.filter((value) => value === "partly").length} · Not today: {answered.filter((value) => value === "not_today").length}</p></> : <p className="alignment-small">No answered days yet.</p>}{question.key === "values_choice" ? <p className="alignment-small">No challenge arose: {noChallenge} {noChallenge === 1 ? "day" : "days"} · shown separately.</p> : null}</div>;
              })}</div>
              <p className="alignment-small">Counts reflect days you chose to record. Unrecorded days and blank responses are not included in the denominators.</p>
            </section>
            <section className="alignment-card" aria-labelledby={`${id}-review`}><p className="alignment-kicker">Weekly review · about 5 minutes</p><h2 id={`${id}-review`}>Keep what works. Adjust gently.</h2><p className="alignment-help">You can review the week at any point, even if you recorded nothing.</p>
              <label className="alignment-label" htmlFor={`${id}-helped`}>What helped?</label><textarea className="alignment-field" id={`${id}-helped`} rows={3} maxLength={1000} placeholder="An action, a person, a place, a little more rest…" value={weekly.helped ?? ""} disabled={disabled} onChange={(event) => updateWeek({ helped: nullable(event.target.value) })} />
              <label className="alignment-label" htmlFor={`${id}-adjust`}>What would I adjust?</label><textarea className="alignment-field" id={`${id}-adjust`} rows={3} maxLength={1000} placeholder="What could be smaller, easier, or better supported?" value={weekly.adjustment ?? ""} disabled={disabled} onChange={(event) => updateWeek({ adjustment: nullable(event.target.value) })} />
              <label className="alignment-label" htmlFor={`${id}-next`}>One priority for next week</label><input className="alignment-field" id={`${id}-next`} maxLength={1000} placeholder="A direction to return to, rather than a whole new plan." value={weekly.next_priority ?? ""} disabled={disabled} onChange={(event) => updateWeek({ next_priority: nullable(event.target.value) })} /><p className="alignment-small">This is a reflection. It does not create or change a goal in My plan.</p>
            </section>
            <div className="alignment-form-footer"><div><p className="alignment-small">{preview ? "This is an example weekly review. Nothing is saved." : "Optional, private to you in Aligned, and editable later."}</p><p className="alignment-small">{weekDirty ? "Draft changes · kept here while you switch views." : "A useful next step is enough."}</p></div><button className="btn btn-p" type="button" disabled={disabled || unavailable || !weekDirty} onClick={() => save("week")}>{busy ? "Working…" : preview ? "Update preview" : "Save review privately"}</button></div>
          </section>

          <section role="tabpanel" id={`${id}-panel-privacy`} aria-labelledby={`${id}-tab-privacy`} hidden={view !== "privacy"} className="alignment-stack">
            <section className="alignment-card"><p className="alignment-kicker">You choose what to keep</p><h2>Private, optional, yours.</h2><p className="alignment-help">{preview ? "This design preview uses fictional data. Changes stay in this browser page’s memory and disappear on reload." : "Use the practices without keeping a record, or choose Save privately when you want an entry in your history. Your saved daily entries and weekly reviews are private to you in Aligned and are not shared with your coach."}</p><p className="alignment-help">Drafts stay in this page while you switch views. They are not automatically saved, stored on this device, or included in exports. Leaving or refreshing discards them.</p><p className="alignment-help">There are no streaks to protect and no missed days to catch up. You decide when to return.</p></section>
            <section className="alignment-card"><h2>{preview ? "Example history" : "Your saved days"}</h2><p className="alignment-help">This week: {week ? dateLabel(week) : "…"}. Choose another date above to open another week.</p><div className="alignment-history-list">{weekDays.length ? weekDays.map((entry) => <button key={entry.entry_date} type="button" className="alignment-history-item" disabled={disabled} onClick={() => { changeDate(entry.entry_date); changeView("today"); }}><strong>{dateLabel(entry.entry_date)}</strong><span>{entry.priority || "A daily reflection"}</span><span aria-hidden="true">↗</span></button>) : <p className="alignment-empty">No saved entries for this week.</p>}</div></section>
            <section className="alignment-card"><h2>Manage your alignment data</h2><p className="alignment-help">Export includes all your saved Daily Alignment entries and Weekly Reviews. It does not include your audit, goals or coaching records. A downloaded file may contain personal reflections: keep it somewhere private.</p><button className="btn btn-g" type="button" disabled={disabled || unavailable} onClick={exportData}>{preview ? "Export fictional example data" : "Export my alignment data"}</button>
              <div className="alignment-divider" />
              <p className="alignment-help">Deletion below affects only the selected daily entry or weekly review. Your plan, audit and other entries stay as they are.</p>
              <div className="alignment-stack">{savedDays[date] ? <button className="alignment-secondary" type="button" disabled={disabled || unavailable} onClick={() => setDeleteConfirm("day")}>Delete daily entry for {dateLabel(date)}</button> : <p className="alignment-small">No saved daily entry for the selected date.</p>}{savedWeeks[week] ? <button className="alignment-secondary" type="button" disabled={disabled || unavailable} onClick={() => setDeleteConfirm("week")}>Delete review for week of {dateLabel(week)}</button> : <p className="alignment-small">No saved weekly review for the selected week.</p>}</div>
              {deleteConfirm ? <div className="alignment-warning" role="alert"><p>Delete {deleteConfirm === "day" ? `the daily entry for ${dateLabel(date)}` : `the weekly review for ${dateLabel(week)}`}? This cannot be undone. Any draft for this {deleteConfirm === "day" ? "day" : "week"} will also be cleared.</p><div className="alignment-inline"><button type="button" className="btn btn-g" disabled={busy} onClick={() => setDeleteConfirm(null)}>Keep it</button><button type="button" className="btn btn-p" disabled={busy} onClick={() => remove(deleteConfirm)}>{busy ? "Deleting…" : "Delete this entry"}</button></div></div> : null}
            </section>
          </section>
        </> : null}
        <p className={`alignment-status${failure ? " alignment-status-error" : ""}`} role={failure ? "alert" : "status"} aria-live="polite">{status}</p>
        {!preview && anyDirty ? <p className="alignment-small">You have unsaved changes in this session. Save the day or review you want to keep before leaving.</p> : null}
      </main>
    </>
  );
}
