"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  addCalendarDays, alignmentWins, describeCounts, isAlignmentDate, isAlignmentTimeZone, localDate, summariseWeek, weekDates, weekStart,
  type AlignmentData, type AlignmentDaily, type AlignmentScore, type AlignmentWeekly, type DailyAlignmentInput,
  type ScoreField, type WeeklyAlignmentInput,
} from "@/lib/alignment";
import { AUDIO } from "@/lib/audit-guides";
import { PracticeAudio } from "./PracticeAudio";

// Daily Alignment: Today, Weekly review, Privacy & history. Nothing is sent
// to the server until "Save privately" (or "Save review privately"); drafts
// live only in this component's memory, per date and per week, and are
// discarded when the page is left or reloaded. No autosave, no local storage.

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

const QUESTIONS: { key: ScoreField; title: string; short: string }[] = [
  { key: "wellbeing", title: "Did I do something that supported my wellbeing?", short: "Wellbeing" },
  { key: "meaningful_action", title: "Did I take a meaningful step towards something that matters?", short: "Meaningful action" },
  { key: "participation", title: "Did I take part in life, in a way that mattered to me?", short: "Participation in life" },
  { key: "values_choice", title: "When a challenge arose, did I pause and choose a response that fitted my values?", short: "Conscious values-based choice" },
];
const choicesFor = (key: ScoreField): { value: AlignmentScore | null; label: string }[] => [
  { value: "yes", label: "Yes" },
  { value: "partly", label: "Partly" },
  { value: "not_today", label: "Not today" },
  ...(key === "values_choice" ? [{ value: "not_needed" as const, label: "No challenge arose" }] : []),
  { value: null, label: "Leave blank" },
];

// Labels only: the date is a calendar label, formatted at UTC noon so the
// device's own zone can never shift it.
function dateLabel(date: string, full = false) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric", ...(full ? { weekday: "long" } : {}) })
    .format(new Date(`${date}T12:00:00Z`));
}
const zoneLabel = (zone: string) => zone.replaceAll("_", " ");
function blankDay(date: string, timezone: string): DailyAlignmentInput {
  return { entry_date: date, timezone, presence_done: null, priority: null, goal_id: null, value: null, wellbeing_action: null, evening_note: null, wellbeing: null, meaningful_action: null, participation: null, values_choice: null };
}
function blankWeek(date: string, timezone: string): WeeklyAlignmentInput {
  return { week_start: date, timezone, helped: null, adjustment: null, next_priority: null };
}
function dailyInput(e: AlignmentDaily): DailyAlignmentInput {
  return { entry_date: e.entry_date, timezone: e.timezone, presence_done: e.presence_done, priority: e.priority, goal_id: e.goal_id, value: e.value, wellbeing_action: e.wellbeing_action, evening_note: e.evening_note, wellbeing: e.wellbeing, meaningful_action: e.meaningful_action, participation: e.participation, values_choice: e.values_choice };
}
function weeklyInput(e: AlignmentWeekly): WeeklyAlignmentInput {
  return { week_start: e.week_start, timezone: e.timezone, helped: e.helped, adjustment: e.adjustment, next_priority: e.next_priority };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const orNull = (value: string) => (value === "" ? null : value);
// Starting points for the day's value; their own word is always welcome.
const VALUE_IDEAS = ["Care", "Honesty", "Connection", "Courage", "Steadiness"];
const WIN_NAMES = [
  { key: "arrive", label: "Arrived" },
  { key: "intention", label: "Intention set" },
  { key: "reflect", label: "Evening reflection" },
] as const;
const dayLetter = (date: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "narrow" }).format(new Date(`${date}T12:00:00Z`));
const dayName = (date: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" }).format(new Date(`${date}T12:00:00Z`));
function WinMark({ done }: { done: boolean }) {
  return done ? (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="dp-mark"><circle cx="9" cy="9" r="9" fill="currentColor" /><path d="M5 9.2l2.6 2.6L13 6.4" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="dp-mark"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
  );
}

export function AlignmentWorkspace({ service, initialDate, initialTimezone, initialView = "today" }: { service: AlignmentService; initialDate?: string; initialTimezone?: string; initialView?: View }) {
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [view, setView] = useState<View>(initialView);
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [zoneSource, setZoneSource] = useState<"profile" | "device" | "utc">("utc");
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

  const week = date ? weekStart(date) : "";
  const weekEnd = week ? addCalendarDays(week, 6) : "";
  const daily = drafts[date] ?? blankDay(date, timezone);
  const weekly = weekDrafts[week] ?? blankWeek(week, timezone);
  const dirty = !same(daily, baselines[date] ?? blankDay(date, timezone));
  const weekDirty = !same(weekly, weekBaselines[week] ?? blankWeek(week, timezone));
  const anyDirty =
    Object.entries(drafts).some(([k, v]) => !same(v, baselines[k] ?? blankDay(k, v.timezone))) ||
    Object.entries(weekDrafts).some(([k, v]) => !same(v, weekBaselines[k] ?? blankWeek(k, v.timezone)));
  const unavailable = data?.available === false;
  const disabled = loading || busy;
  const weekDays = week ? Object.values(savedDays).filter((e) => e.entry_date >= week && e.entry_date <= weekEnd).sort((a, b) => a.entry_date.localeCompare(b.entry_date)) : [];
  const counts = week && today ? summariseWeek(weekDays, week, today) : null;
  const mainGoal = data?.goals[0] ?? null;
  const linkedGoal = daily.goal_id ? data?.goals.find((g) => g.id === daily.goal_id) ?? null : null;
  // Wins: the day on screen as it stands (drafts included); other days as saved.
  const wins = alignmentWins(daily);
  const weekWins = week ? weekDates(week).map((d) => ({ date: d, wins: d === date ? wins.count : alignmentWins(savedDays[d]).count, future: !!today && d > today })) : [];

  // The member's zone: Your details if set, else this device's zone (said
  // plainly), else UTC (also said plainly). Never written back to the profile.
  useEffect(() => {
    let device: string | undefined;
    try { device = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* UTC fallback */ }
    const saved = isAlignmentTimeZone(initialTimezone) ? initialTimezone : null;
    const fromDevice = isAlignmentTimeZone(device) ? device : null;
    const zone = saved ?? fromDevice ?? "UTC";
    const local = localDate(zone);
    setToday(local);
    setDate(isAlignmentDate(initialDate) && initialDate <= local ? initialDate : local);
    setTimezone(zone);
    setZoneSource(saved ? "profile" : fromDevice ? "device" : "utc");
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
      for (const entry of result.days) {
        dayInputs[entry.entry_date] = dailyInput(entry);
        entries[entry.entry_date] = entry;
      }
      // Unsaved drafts already in memory win over freshly loaded values.
      setDrafts((current) => ({ ...dayInputs, ...current }));
      setBaselines((current) => ({ ...dayInputs, ...current }));
      setSavedDays((current) => ({ ...current, ...entries }));
      const weekInput = result.weekly ? weeklyInput(result.weekly) : blankWeek(result.week_start, timezone);
      setWeekDrafts((current) => ({ [result.week_start]: weekInput, ...current }));
      setWeekBaselines((current) => ({ [result.week_start]: weekInput, ...current }));
      if (result.weekly) setSavedWeeks((current) => ({ ...current, [result.week_start]: result.weekly! }));
    }).catch(() => {
      if (!cancelled) setLoadError("Your saved entries couldn’t be loaded. Try again before editing, so nothing you saved earlier is overwritten.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, timezone, service, reload]);

  // Leaving with unsaved drafts: the browser's own prompt, and a confirm on
  // in-app links. Nothing is saved for them.
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const guardLinks = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const a = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin || (to.pathname === window.location.pathname && to.search === window.location.search)) return;
      if (!window.confirm("You have unsaved changes here. Leave and discard them?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLinks, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLinks, true);
    };
  }, [anyDirty]);

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
        setDrafts((c) => ({ ...c, [date]: input }));
        setBaselines((c) => ({ ...c, [date]: input }));
        setSavedDays((c) => ({ ...c, [date]: result.entry }));
        setStatus(`Saved privately for ${date === today ? "today" : dateLabel(date)}. You can come back and edit it.`);
      } else {
        const result = await service.saveWeekly(weekly);
        if (!result.ok) { setFailure(true); setStatus(result.message); return; }
        const input = weeklyInput(result.entry);
        setWeekDrafts((c) => ({ ...c, [week]: input }));
        setWeekBaselines((c) => ({ ...c, [week]: input }));
        setSavedWeeks((c) => ({ ...c, [week]: result.entry }));
        setStatus("Weekly review saved privately. You can come back and edit it.");
      }
    } catch {
      setFailure(true);
      setStatus("This couldn’t be saved. Your draft is still here. Please try again.");
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
        setDrafts((c) => ({ ...c, [date]: blank }));
        setBaselines((c) => ({ ...c, [date]: blank }));
        setSavedDays((c) => { const n = { ...c }; delete n[date]; return n; });
        setStatus("This day has been deleted. The week’s counts have updated; a weekly review you wrote stays until you delete it separately.");
      } else {
        const blank = blankWeek(week, timezone);
        setWeekDrafts((c) => ({ ...c, [week]: blank }));
        setWeekBaselines((c) => ({ ...c, [week]: blank }));
        setSavedWeeks((c) => { const n = { ...c }; delete n[week]; return n; });
        setStatus("This weekly review has been deleted. Your daily entries are unchanged.");
      }
      setDeleteConfirm(null);
    } catch { setFailure(true); setStatus("This couldn’t be deleted. Please try again."); }
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
      link.download = `aligned-daily-alignment-${today}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Your saved entries have been exported. Unsaved drafts aren’t included. Keep the file somewhere private.");
    } catch { setFailure(true); setStatus("Your export couldn’t be prepared. Please try again."); }
    finally { setBusy(false); }
  }
  const changeView = (next: View) => { setView(next); setDeleteConfirm(null); };
  const changeDate = (next: string) => { if (isAlignmentDate(next) && next <= today) setDate(next); };

  return (
    <>
      <div className="topbar"><Link href="/" className="tb-back">← My profile</Link><span className="tb-label">Daily practice</span></div>
      <div className="page alignment-page">
        <header className="alignment-head">
          <div className="eyebrow"><span className="eydot" /> Daily practice{today ? <> · {dateLabel(today, true).replace(/ \d{4}$/, "")}</> : null}</div>
          <h1>Start from where you are <em>today.</em></h1>
          <p className="alignment-lede">Three small wins: arrive, set an intention, reflect this evening. Use what helps; leave the rest.</p>
          <p className="alignment-help">Nothing is saved until you choose <b>Save privately</b>.</p>
        </header>

        <div className="dp-tabs">
        <div className="alignment-tabs" role="tablist" aria-label="Daily practice">
          {([{ key: "today", label: "Today" }, { key: "week", label: "Weekly review" }, { key: "privacy", label: "Privacy & history" }] as const).map((tab, index, all) => (
            <button
              key={tab.key}
              ref={(node) => { tabs.current[index] = node; }}
              type="button"
              role="tab"
              id={`${id}-tab-${tab.key}`}
              aria-controls={`${id}-panel-${tab.key}`}
              aria-selected={view === tab.key}
              tabIndex={view === tab.key ? 0 : -1}
              onClick={() => changeView(tab.key)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === "ArrowRight") next = (index + 1) % all.length;
                else if (event.key === "ArrowLeft") next = (index + all.length - 1) % all.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = all.length - 1;
                else return;
                event.preventDefault();
                changeView(all[next].key);
                tabs.current[next]?.focus();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Link href="/alignment/journal" className="dp-tab-link">Journal</Link>
        </div>

        <div className="alignment-date">
          <div>
            <p className="alignment-kicker">{view === "week" ? "Week (Monday to Sunday)" : date === today ? "Today" : "The day you’re looking at"}</p>
            <strong>{date ? (view === "week" ? `${dateLabel(week)} – ${dateLabel(weekEnd)}` : dateLabel(date, true)) : "Finding your local day…"}</strong>
          </div>
          <div>
            <label htmlFor={`${id}-date`} className="alignment-small">{view === "week" ? "Choose a day in another week" : "Choose another day"}</label>
            <input className="alignment-field" id={`${id}-date`} type="date" value={date} max={today} disabled={busy || !today} onChange={(e) => changeDate(e.target.value)} />
          </div>
        </div>
        {date ? (
          <p className="alignment-small">
            Dates use <b>{zoneLabel(timezone)}</b>
            {zoneSource === "device" ? " (this device’s time zone)" : zoneSource === "utc" ? " (UTC, because no time zone is set)" : ""}.{" "}
            <Link href="/details">{zoneSource === "profile" ? "Change it in Your details" : "Set your time zone in Your details"}</Link>.{" "}
            {date !== today ? <button className="alignment-secondary" type="button" disabled={busy} onClick={() => changeDate(today)}>Back to today</button> : null}
          </p>
        ) : null}
        {loading ? <p className="alignment-notice" role="status">Opening…</p> : null}
        {loadError ? (
          <div className="alignment-notice" role="alert">
            <p>{loadError}</p>
            <button className="btn btn-g" type="button" onClick={() => setReload((v) => v + 1)}>Try again</button>
          </div>
        ) : null}
        {unavailable ? <div className="alignment-notice" role="note">Private saving is not available yet. You can still use everything below; it stays on this page only and disappears when you leave.</div> : null}

        {!loadError ? (
          <>
            {/* Today */}
            <section role="tabpanel" id={`${id}-panel-today`} aria-labelledby={`${id}-tab-today`} hidden={view !== "today"} className="dp-layout">
              <div className="alignment-stack dp-main">
              <section className="alignment-card dp-win dp-win-lead" aria-labelledby={`${id}-arrive`}>
                <p className="alignment-kicker">Morning · win 1</p>
                <h2 id={`${id}-arrive`}>Arrive for a moment</h2>
                <PracticeAudio clip={AUDIO.D01} onFinish={() => updateDay({ presence_done: true })} />
                <p className="alignment-help">
                  Feel your feet. Notice your breathing and what is around you. Let thoughts and feelings be here without
                  needing to solve them. Ask: <em>&ldquo;What matters in how I live today?&rdquo;</em> Five minutes if you have
                  them. One breath counts too.
                </p>
                <label className={`dp-done${daily.presence_done ? " is-done" : ""}`}>
                  <input type="checkbox" checked={daily.presence_done === true} disabled={disabled} onChange={(e) => updateDay({ presence_done: e.target.checked ? true : null })} />
                  <span>
                    <b>Done. I took a moment to arrive.</b>
                    <span className="alignment-small">{AUDIO.D01.src ? "Ticks itself when the audio finishes, or tick it yourself." : "Tick it when you have."}</span>
                  </span>
                </label>
              </section>

              <section className="alignment-card dp-win" aria-labelledby={`${id}-intention-h`}>
                <p className="alignment-kicker">Morning · win 2</p>
                <h2 id={`${id}-intention-h`}>Set today&rsquo;s intention</h2>
                <p className="alignment-help">Answer one, two or all three.</p>
                <h3 className="alignment-q">
                  <label htmlFor={`${id}-priority`}>What is one meaningful thing I will give time to today?</label>
                </h3>
                <input className="alignment-field" id={`${id}-priority`} maxLength={500} placeholder="For example: spend twenty minutes on the project proposal before opening messages." value={daily.priority ?? ""} disabled={disabled} onChange={(e) => updateDay({ priority: orNull(e.target.value) })} />
                {linkedGoal ? (
                  <p className="alignment-small alignment-goal">
                    Linked to your goal in My plan: <b>{linkedGoal.goal_title?.replace(/\.$/, "")}</b>{" "}
                    <button className="alignment-secondary" type="button" disabled={disabled} onClick={() => updateDay({ goal_id: null })}>Remove link</button>
                  </p>
                ) : mainGoal?.goal_title ? (
                  <div className="alignment-goal">
                    <p className="alignment-small">Your main goal in <Link href="/clear">My plan</Link>: <b>{mainGoal.goal_title}</b></p>
                    <button className="alignment-secondary" type="button" disabled={disabled} onClick={() => updateDay({ priority: daily.priority ?? mainGoal.goal_title, goal_id: mainGoal.id })}>Use this goal</button>
                    <span className="alignment-small">Your plan stays exactly as it is.</span>
                  </div>
                ) : (
                  <p className="alignment-small">It can be part of <Link href="/clear">My plan</Link>, or simply something that matters today.</p>
                )}

                <h3 className="alignment-q dp-q"><label htmlFor={`${id}-value`}>What value do I want to practise today?</label></h3>
                <div className="dp-chips" role="group" aria-label="Value ideas">
                  {VALUE_IDEAS.map((v) => {
                    const on = (daily.value ?? "").trim().toLowerCase() === v.toLowerCase();
                    return (
                      <button key={v} type="button" className={`dp-chip${on ? " is-on" : ""}`} aria-pressed={on} disabled={disabled} onClick={() => updateDay({ value: on ? null : v })}>{v}</button>
                    );
                  })}
                </div>
                <input className="alignment-field" id={`${id}-value`} maxLength={80} placeholder="Or your own word" value={daily.value ?? ""} disabled={disabled} onChange={(e) => updateDay({ value: orNull(e.target.value) })} />
                <details className="alignment-pause">
                  <summary>When I feel pulled off course</summary>
                  <ol className="alignment-pause-steps">
                    <li><strong>Notice.</strong> &ldquo;I am noticing a thought, feeling or urge.&rdquo;</li>
                    <li><strong>Allow.</strong> Pause and make room for the feeling. It does not need to disappear first.</li>
                    <li><strong>Choose.</strong> &ldquo;What choice fits {daily.value ? <>the value of <em>{daily.value}</em></> : "the value I want to practise"}?&rdquo;</li>
                    <li><strong>Act.</strong> Take one small useful step. Getting support can be that step.</li>
                  </ol>
                  <p className="alignment-small">Nothing here is recorded.</p>
                </details>

                <h3 className="alignment-q dp-q"><label htmlFor={`${id}-care`}>What is one small way I will care for myself today?</label></h3>
                <input className="alignment-field" id={`${id}-care`} maxLength={300} placeholder="For example: a walk, a proper meal, rest, some movement or calling someone" value={daily.wellbeing_action ?? ""} disabled={disabled} onChange={(e) => updateDay({ wellbeing_action: orNull(e.target.value) })} />
                <p className="alignment-small">Rest counts. Asking for help counts.</p>
              </section>

              <section className="alignment-card dp-win dp-win-evening" aria-labelledby={`${id}-evening`}>
                <p className="alignment-kicker">Evening · win 3</p>
                <h2 id={`${id}-evening`}>Reflect on the day</h2>
                <p className="alignment-help">A reflection of this day, not a grade. Answer what is useful; anything left blank stays blank.</p>
                <PracticeAudio clip={AUDIO.D02} quiet />
                {QUESTIONS.map((q) => (
                  <fieldset key={q.key} className="alignment-score-row" disabled={disabled}>
                    <legend>{q.title}</legend>
                    <div className="alignment-options">
                      {choicesFor(q.key).map((c) => (
                        <label key={c.value ?? "blank"} className="alignment-option">
                          <input type="radio" name={`${id}-${q.key}`} value={c.value ?? ""} checked={daily[q.key] === c.value} onChange={() => updateDay({ [q.key]: c.value })} />
                          <span>{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <label className="alignment-label" htmlFor={`${id}-reflection`}>What do I want to notice or carry into tomorrow? <span className="alignment-small">Optional</span></label>
                <textarea className="alignment-field" id={`${id}-reflection`} rows={3} maxLength={1000} value={daily.evening_note ?? ""} disabled={disabled} onChange={(e) => updateDay({ evening_note: orNull(e.target.value) })} />
                <p className="alignment-small">A difficult day is information, not a verdict. Begin again from where you are.</p>
              </section>

              <div className="alignment-form-footer">
                <div>
                  <p className="alignment-small"><b>Only you can see this in Aligned. Your coach cannot see these entries.</b></p>
                  <p className="alignment-small">
                    {dirty ? "Unsaved changes. They stay here while you switch tabs or days, until you leave this page."
                      : savedDays[date] ? "Saved privately. Edit anything and save again to update it."
                      : "Everything is optional. There is nothing to catch up on."}
                  </p>
                </div>
                <button className="btn btn-p" type="button" disabled={disabled || unavailable || !dirty} onClick={() => save("day")}>{busy ? "Saving…" : "Save privately"}</button>
              </div>
              </div>

              <aside className="dp-rail" aria-label={date === today ? "Today’s wins" : "This day’s wins"}>
                <section className="dp-rail-card">
                  <div className="dp-ring-row">
                    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${wins.count} of 3 wins`}>
                      <circle cx="32" cy="32" r="27" fill="none" stroke="var(--bg5)" strokeWidth="6" />
                      <circle cx="32" cy="32" r="27" fill="none" stroke="var(--gold)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(wins.count / 3) * 169.6} 169.6`} transform="rotate(-90 32 32)" className="dp-ring" />
                      <text x="32" y="38" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--text)" className="dp-ring-n">{wins.count}/3</text>
                    </svg>
                    <div>
                      <p className="dp-rail-h">{date === today ? "Today’s wins" : `${dayName(date || today || "2026-01-01")}’s wins`}</p>
                      <p className="alignment-small">{wins.count === 3 ? "All three. Well done." : "Every one counts."}</p>
                    </div>
                  </div>
                  <ul className="dp-win-list">
                    {WIN_NAMES.map((w) => (
                      <li key={w.key} className={wins[w.key] ? "is-done" : undefined}><WinMark done={wins[w.key]} />{w.label}</li>
                    ))}
                  </ul>
                  {dirty && wins.count ? <p className="alignment-small">Save privately to keep {wins.count === 1 ? "it" : "them"}.</p> : null}
                </section>
                <section className="dp-rail-card">
                  <p className="dp-rail-h">This week</p>
                  <ol className="dp-week">
                    {weekWins.map((d) => (
                      <li key={d.date} className={`${d.wins === 3 ? "is-full" : d.wins ? "is-some" : ""}${d.date === date ? " is-on" : ""}${d.future ? " is-future" : ""}`}>
                        <span aria-hidden="true" />
                        <b aria-hidden="true">{dayLetter(d.date)}</b>
                        <span className="sr-only">{dayName(d.date)}: {d.future ? "still to come" : `${d.wins} of 3 wins`}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="alignment-small">Full gold: all three wins. Soft gold: some.</p>
                </section>
                <section className="dp-rail-note">
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
                  <p><b>Private to you.</b> Your coach can&rsquo;t see your daily practice or journal.</p>
                </section>
              </aside>
            </section>

            {/* Weekly review */}
            <section role="tabpanel" id={`${id}-panel-week`} aria-labelledby={`${id}-tab-week`} hidden={view !== "week"} className="alignment-stack">
              <div className="alignment-inline">
                <button className="alignment-secondary" type="button" disabled={disabled || !week} onClick={() => changeDate(addCalendarDays(week, -7))}>← Previous week</button>
                <button className="alignment-secondary" type="button" disabled={disabled || !week || !today || week >= weekStart(today)} onClick={() => changeDate(addCalendarDays(week, 7) > today ? today : addCalendarDays(week, 7))}>Next week →</button>
              </div>
              <section className="alignment-card" aria-labelledby={`${id}-helped-h`}>
                <h2 id={`${id}-helped-h`}>What helped me live more like I intended?</h2>
                <p className="alignment-help">From the days you chose to save, {week ? `${dateLabel(week)} – ${dateLabel(weekEnd)}` : ""} ({zoneLabel(timezone)}). Blank answers stay blank, and there is no overall score.</p>
                {counts ? (
                  <ul className="alignment-week-grid">
                    {QUESTIONS.map((q) => {
                      const c = counts[q.key];
                      const words = describeCounts(c);
                      return (
                        <li className="alignment-week-row" key={q.key}>
                          <h3>{q.short}</h3>
                          <p>{words.answers}</p>
                          <p className="alignment-small">{words.days}</p>
                          {q.key === "values_choice" && c.not_needed ? <p className="alignment-small">No challenge arose: {c.not_needed} {c.not_needed === 1 ? "day" : "days"} (counted separately)</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <p className="alignment-small">These counts only describe what you saved, not everything you did.</p>
              </section>
              <section className="alignment-card" aria-labelledby={`${id}-review-h`}>
                <h2 id={`${id}-review-h`}>Your weekly review</h2>
                <label className="alignment-label" htmlFor={`${id}-helped`}>What helped this week?</label>
                <textarea className="alignment-field" id={`${id}-helped`} rows={3} maxLength={1000} value={weekly.helped ?? ""} disabled={disabled} onChange={(e) => updateWeek({ helped: orNull(e.target.value) })} />
                <label className="alignment-label" htmlFor={`${id}-adjust`}>What would I like to adjust?</label>
                <textarea className="alignment-field" id={`${id}-adjust`} rows={3} maxLength={1000} value={weekly.adjustment ?? ""} disabled={disabled} onChange={(e) => updateWeek({ adjustment: orNull(e.target.value) })} />
                <label className="alignment-label" htmlFor={`${id}-next`}>What is one meaningful priority for next week?</label>
                <input className="alignment-field" id={`${id}-next`} maxLength={1000} value={weekly.next_priority ?? ""} disabled={disabled} onChange={(e) => updateWeek({ next_priority: orNull(e.target.value) })} />
                <p className="alignment-small">This doesn&rsquo;t create or change a goal. To change your goal, go to <Link href="/clear">My plan</Link>.</p>
              </section>
              <div className="alignment-form-footer">
                <div>
                  <p className="alignment-small"><b>Only you can see this in Aligned. Your coach cannot see these entries.</b></p>
                  <p className="alignment-small">{weekDirty ? "Unsaved changes, kept while you stay on this page." : savedWeeks[week] ? "Saved privately. Edit and save again to update it." : "You can review any week, even one with nothing saved."}</p>
                </div>
                <button className="btn btn-p" type="button" disabled={disabled || unavailable || !weekDirty} onClick={() => save("week")}>{busy ? "Saving…" : "Save review privately"}</button>
              </div>
            </section>

            {/* Privacy & history */}
            <section role="tabpanel" id={`${id}-panel-privacy`} aria-labelledby={`${id}-tab-privacy`} hidden={view !== "privacy"} className="alignment-stack">
              <section className="alignment-card">
                <h2>Private, optional, yours.</h2>
                <p className="alignment-help">Use the practice without keeping anything, or choose Save privately when you want a record. Saved entries are visible only to you in Aligned; your coach can&rsquo;t see them.</p>
                <p className="alignment-help">Unsaved drafts stay on this page only. They aren&rsquo;t saved on this device or included in exports, and they&rsquo;re gone when you leave.</p>
              </section>
              <section className="alignment-card">
                <h2>Saved days, {week ? `${dateLabel(week)} – ${dateLabel(weekEnd)}` : "this week"}</h2>
                <p className="alignment-small">Choose a date above to see another week.</p>
                <div className="alignment-history-list">
                  {weekDays.length ? weekDays.map((e) => {
                    const answered = QUESTIONS.filter((q) => e[q.key] !== null).length;
                    return (
                      <button key={e.entry_date} type="button" className="alignment-history-item" disabled={disabled} onClick={() => { changeDate(e.entry_date); changeView("today"); }}>
                        <strong>{dateLabel(e.entry_date)}</strong>
                        <span>{e.priority || "A saved reflection"}</span>
                        <span className="alignment-small">{answered === 4 ? "All four questions answered" : `${answered} of 4 questions answered`} · {zoneLabel(e.timezone)} · Edit</span>
                      </button>
                    );
                  }) : <p className="alignment-empty">Nothing saved this week.</p>}
                </div>
              </section>
              <section className="alignment-card">
                <h2>Your data</h2>
                <p className="alignment-help">Export includes every Daily Alignment entry and weekly review you&rsquo;ve saved, and nothing else. The file may contain personal reflections, so keep it somewhere private.</p>
                <button className="btn btn-g" type="button" disabled={disabled || unavailable} onClick={exportData}>Export my alignment data</button>
                <div className="alignment-divider" />
                <div className="alignment-stack">
                  {savedDays[date] ? <button className="alignment-secondary" type="button" disabled={disabled || unavailable} onClick={() => setDeleteConfirm("day")}>Delete this day ({dateLabel(date)})</button> : <p className="alignment-small">No saved entry for {date ? dateLabel(date) : "this day"}.</p>}
                  {savedWeeks[week] ? <button className="alignment-secondary" type="button" disabled={disabled || unavailable} onClick={() => setDeleteConfirm("week")}>Delete this weekly review (week of {dateLabel(week)})</button> : <p className="alignment-small">No saved review for this week.</p>}
                </div>
                {deleteConfirm ? (
                  <div className="alignment-warning" role="alert">
                    <p>
                      {deleteConfirm === "day"
                        ? `Delete your entry for ${dateLabel(date)}? This can’t be undone. The week’s counts will update; a weekly review stays until you delete it separately.`
                        : `Delete your weekly review for the week of ${dateLabel(week)}? This can’t be undone. Your daily entries stay.`}
                    </p>
                    <div className="alignment-inline">
                      <button type="button" className="btn btn-g" disabled={busy} onClick={() => setDeleteConfirm(null)}>Keep it</button>
                      <button type="button" className="btn btn-p" disabled={busy} onClick={() => remove(deleteConfirm)}>{busy ? "Deleting…" : "Delete"}</button>
                    </div>
                  </div>
                ) : null}
              </section>
            </section>
          </>
        ) : null}
        <p className={`alignment-status${failure ? " alignment-status-error" : ""}`} role={failure ? "alert" : "status"} aria-live="polite">{status}</p>
      </div>
    </>
  );
}
