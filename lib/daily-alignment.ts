// The Daily Alignment (Duane's build brief v1, 11 Nov 2026): everyday actions
// tied to the Alignment Map, each measured one way, and the evidence they
// leave. Pure helpers, so they can be tested; reads and writes are in
// lib/actions/daily.ts. Dates are YYYY-MM-DD calendar days; weekdays are
// 0 = Monday … 6 = Sunday. No scores, no streaks that break: neutral
// evidence only ("2 of 4 visits this week", "Day 18").

import { addDays, daysLabel, timeLabel, weekdayOf } from "./daily-log.ts";

export type Measure = "done" | "count" | "minutes" | "run";
export type Period = "day" | "week" | "month";
export type ActionStatus = "active" | "paused" | "completed" | "archived";

export type DailyAction = {
  id: string;
  name: string;
  measure: Measure;
  target: number | null;
  period: Period;
  unit: string | null;
  life_area_id: string | null;
  goal_id: string | null;
  days: number[];
  at_time: string | null;
  start_date: string;
  end_date: string | null;
  mindful: boolean;
  private: boolean;
  status: ActionStatus;
  run_started: string | null;
  run_paused: string | null;
  run_ended: string | null;
  position: number;
};

export type ActionLog = {
  id: string;
  action_id: string;
  log_date: string;
  tick: boolean;
  amount: number;
  seconds: number;
  source: "manual" | "timer" | "review";
  note: string | null;
};

export const MEASURES: { key: Measure; label: string; help: string }[] = [
  { key: "done", label: "Done or not", help: "Tick it off: the gym, a yoga class, your focus block." },
  { key: "count", label: "A count", help: "How many: visits, walks, calls, applications." },
  { key: "minutes", label: "Minutes", help: "How long: meditation, yoga, reading. Use the timer or add minutes." },
  { key: "run", label: "A current run", help: "Days in a row of something: alcohol-free, no phone before work. Private by default." },
];

// More than this many active actions and the page suggests trimming, never blocks.
export const ACTION_ADVICE_LIMIT = 5;

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

// The period a day falls in: the week (Monday first), the month, or the day.
export function periodStart(period: Period, day: string): string {
  if (period === "day") return day;
  if (period === "week") return addDays(day, -weekdayOf(day));
  return `${day.slice(0, 7)}-01`;
}
export const weekStartOf = (day: string) => periodStart("week", day);

const PERIOD_WORD: Record<Period, string> = { day: "today", week: "this week", month: "this month" };

// Is it on today's list? Active, started, not ended, and today is one of its days.
export function dueOn(a: DailyAction, day: string): boolean {
  if (a.status !== "active") return false;
  if (a.start_date > day || (a.end_date && a.end_date < day)) return false;
  if (a.measure === "run") return !a.run_ended;
  return !a.days.length || a.days.includes(weekdayOf(day));
}

// When it happens, the same way as Next Step moves: "Weekdays · 8:55am".
export function scheduleLabel(a: Pick<DailyAction, "days" | "at_time">): string {
  const days = [...a.days].sort((x, y) => x - y);
  const when = days.length ? daysLabel(days) : "Any day";
  return a.at_time ? `${when} · ${timeLabel(a.at_time.slice(0, 5))}` : when;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 || word.endsWith("s") ? "" : "s"}`;
export const minutesOf = (seconds: number) => Math.floor(seconds / 60);

// What the measure counts in, in words: "visits", "times", "minutes".
export function unitWord(a: Pick<DailyAction, "measure" | "unit">, n = 2): string {
  const u = a.unit?.trim();
  if (a.measure === "minutes") return n === 1 ? "minute" : "minutes";
  if (u) return n === 1 ? u.replace(/s$/, "") : u;
  return n === 1 ? "time" : "times";
}

export type Progress = {
  // In the action's own period.
  done: number;
  target: number | null;
  // Today alone.
  today: number;
  doneToday: boolean;
  line: string;
};

// The action's evidence, in its own terms: "2 of 4 visits this week",
// "12 minutes today · 46 minutes this week", "Day 18".
export function progressOf(a: DailyAction, logs: ActionLog[], day: string): Progress {
  const mine = logs.filter((l) => l.action_id === a.id);
  const from = periodStart(a.period, day);
  const inPeriod = mine.filter((l) => l.log_date >= from && l.log_date <= day);
  const onDay = mine.filter((l) => l.log_date === day);
  if (a.measure === "run") {
    const n = runDays(a, day);
    const line = !a.run_started ? "Not started" : a.run_ended ? `Ended at ${plural(n, "day")}` : a.run_paused ? `Paused · Day ${n}` : `Day ${n}`;
    return { done: n, target: a.target, today: 0, doneToday: false, line };
  }
  if (a.measure === "minutes") {
    const secs = inPeriod.reduce((s, l) => s + l.seconds, 0);
    const today = onDay.reduce((s, l) => s + l.seconds, 0);
    const done = minutesOf(secs);
    const t = minutesOf(today);
    const line =
      a.period === "day"
        ? a.target ? `${t} of ${a.target} minutes today` : `${t} minutes today`
        : `${t} minutes today · ${a.target ? `${done} of ${a.target}` : done} minutes ${PERIOD_WORD[a.period]}`;
    return { done, target: a.target, today: t, doneToday: !!a.target && a.period === "day" ? t >= a.target : t > 0, line };
  }
  if (a.measure === "count") {
    const done = inPeriod.reduce((s, l) => s + l.amount, 0);
    const today = onDay.reduce((s, l) => s + l.amount, 0);
    const word = unitWord(a, a.target ?? done);
    const line = a.target ? `${done} of ${a.target} ${word} ${PERIOD_WORD[a.period]}` : `${done} ${unitWord(a, done)} ${PERIOD_WORD[a.period]}`;
    return { done, target: a.target, today, doneToday: today > 0, line };
  }
  const done = new Set(inPeriod.filter((l) => l.tick).map((l) => l.log_date)).size;
  const doneToday = onDay.some((l) => l.tick);
  const word = unitWord(a, a.target ?? done);
  const line = a.target ? `${done} of ${a.target} ${word} ${PERIOD_WORD[a.period]}` : `${done} ${unitWord(a, done)} ${PERIOD_WORD[a.period]}`;
  return { done, target: a.target, today: doneToday ? 1 : 0, doneToday, line };
}

// A run's length in days, counting the day it started: frozen while paused
// or once ended.
export function runDays(a: Pick<DailyAction, "run_started" | "run_paused" | "run_ended">, day: string): number {
  if (!a.run_started) return 0;
  const until = a.run_ended ?? a.run_paused ?? day;
  return Math.max(0, daysBetween(a.run_started, until) + 1);
}

// The timer, from its stored times (never from a counter in the page): how
// long it's run, how long is left, and whether it's done. `now` is the
// server's clock, corrected for the device by the page.
export type TimerRow = { action_id: string | null; planned_seconds: number; started_at: string; paused_at: string | null; paused_seconds: number; intention: string | null };
export type TimerState = { elapsed: number; remaining: number; paused: boolean; finished: boolean; endsAt: number | null };
export function timerState(t: TimerRow, now: number): TimerState {
  const started = Date.parse(t.started_at);
  const stopped = t.paused_at ? Date.parse(t.paused_at) : now;
  const raw = Math.max(0, Math.floor((stopped - started) / 1000) - t.paused_seconds);
  const elapsed = Math.min(t.planned_seconds, raw);
  const remaining = t.planned_seconds - elapsed;
  return {
    elapsed,
    remaining,
    paused: !!t.paused_at,
    finished: remaining <= 0,
    endsAt: t.paused_at ? null : started + (t.planned_seconds + t.paused_seconds) * 1000,
  };
}
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Mindful minutes: only actions marked mindful count. Seconds inside,
// whole minutes shown.
export type Mindful = { todaySeconds: number; weekSeconds: number; sessions: number; averageSeconds: number | null };
export function mindfulOf(actions: DailyAction[], logs: ActionLog[], day: string): Mindful {
  const ids = new Set(actions.filter((a) => a.mindful && a.measure === "minutes").map((a) => a.id));
  const from = weekStartOf(day);
  const week = logs.filter((l) => ids.has(l.action_id) && l.seconds > 0 && l.log_date >= from && l.log_date <= day);
  const weekSeconds = week.reduce((s, l) => s + l.seconds, 0);
  return {
    todaySeconds: week.filter((l) => l.log_date === day).reduce((s, l) => s + l.seconds, 0),
    weekSeconds,
    sessions: week.length,
    averageSeconds: week.length ? Math.round(weekSeconds / week.length) : null,
  };
}

// The week, as evidence: for each day, how many actions had something
// logged, and how many were set for that day (actions with set days; "any
// day" ones like "4 gym visits a week" aren't planned for a particular day).
// No colours for a missed day.
export type WeekDay = { date: string; letter: string; planned: number; done: number; today: boolean; future: boolean };
export function weekStrip(actions: DailyAction[], logs: ActionLog[], day: string): WeekDay[] {
  const start = weekStartOf(day);
  const ids = new Set(actions.map((a) => a.id));
  return ["M", "T", "W", "T", "F", "S", "S"].map((letter, i) => {
    const date = addDays(start, i);
    const planned = actions.filter((a) => a.measure !== "run" && a.days.length > 0 && dueOn(a, date)).length;
    const done = new Set(logs.filter((l) => ids.has(l.action_id) && l.log_date === date && (l.tick || l.amount > 0 || l.seconds > 0)).map((l) => l.action_id)).size;
    return { date, letter, planned, done, today: date === day, future: date > day };
  });
}

// "Welcome back. Start with today." after two or more days away. Nothing to
// catch up on: earlier days stay open for a note if they want one.
export function welcomeBack(lastActive: string | null, day: string): boolean {
  return !!lastActive && daysBetween(lastActive, day) >= 2;
}

// Mindful by default for meditation and breathing; anything else is their choice.
export const looksMindful = (name: string) => /\b(meditat\w*|breath\w*|mindful\w*)\b/i.test(name);

// ── The weekly review (release 2) ─────────────────────────────────────────

// Which week to review: early in the week (Monday to Wednesday), last week
// if neither it nor this week has been reviewed yet; otherwise this week.
// Weeks start Monday.
export function reviewWeek(today: string, reviewed: string[]): string {
  const thisWeek = weekStartOf(today);
  const lastWeek = addDays(thisWeek, -7);
  return weekdayOf(today) <= 2 && !reviewed.includes(lastWeek) && !reviewed.includes(thisWeek) ? lastWeek : thisWeek;
}

// A week given as any day of it, back to its Monday; never a future week.
export function weekOf(day: string | null | undefined, today: string): string {
  const thisWeek = weekStartOf(today);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00Z`))) return thisWeek;
  const w = weekStartOf(day);
  return w > thisWeek ? thisWeek : w;
}

const PERIOD_PLAN: Record<Period, string> = { day: "a day", week: "a week", month: "a month" };

// One action in a week, as evidence: what was planned ("4 visits a week ·
// Monday, Wednesday and Friday") and what happened ("3 of 4 visits"). A
// daily or monthly target isn't a weekly one, so the week shows its total.
export type Evidence = { id: string; name: string; areaId: string | null; plan: string | null; happened: string; daysLogged: number };
export function weekEvidence(a: DailyAction, logs: ActionLog[], weekStart: string, today: string): Evidence {
  const end = addDays(weekStart, 6);
  const until = end < today ? end : today;
  const inWeek = logs.filter((l) => l.action_id === a.id && l.log_date >= weekStart && l.log_date <= until);
  const daysLogged = new Set(inWeek.filter((l) => l.tick || l.amount > 0 || l.seconds > 0).map((l) => l.log_date)).size;
  const target = a.target && a.measure !== "run" ? `${a.target} ${unitWord(a, a.target)} ${PERIOD_PLAN[a.period]}` : null;
  const when = a.measure !== "run" && a.days.length ? scheduleLabel(a) : null;
  const plan = [target, when].filter(Boolean).join(" · ") || null;
  let happened: string;
  if (a.measure === "run") {
    happened = progressOf(a, logs, until).line;
  } else {
    const weekly = { ...a, period: "week" as const, target: a.period === "week" ? a.target : null };
    happened = progressOf(weekly, inWeek, until).line.replace(/^\d+ minutes today · /, "").replace(/ this week$/, "");
  }
  return { id: a.id, name: a.name, areaId: a.life_area_id, plan, happened, daysLogged };
}

// "Make it smaller": about three quarters, and always at least one less
// (never below one).
export function smallerTarget(target: number): number {
  if (target <= 1) return 1;
  return Math.max(1, Math.min(target - 1, Math.floor(target * 0.75)));
}

// The weekly review's day: the Next Step's next weekly check-in if there's
// one; otherwise the coming Sunday (today, on a Sunday).
export function reviewDue(today: string, nextCheckIn: string | null): { date: string; due: boolean } {
  const date = nextCheckIn ?? addDays(weekStartOf(today), 6);
  return { date, due: today >= date };
}

// The review in words, for the journal entry and for a coach if they share it.
export const CLOSER_WORDS: Record<string, string> = { closer: "Closer", same: "About the same", further: "Further away" };
export const DECISION_WORDS: Record<string, string> = { keep: "Keep it", smaller: "Make it smaller", change: "Change it" };
export function reviewText(r: { moved?: string | null; helped?: string | null; in_way?: string | null; closer?: string | null; decision?: string | null; stepTitle?: string | null; choices?: { name: string; choice: string; target?: number | null }[] }): string {
  const lines: string[] = [];
  if (r.moved?.trim()) lines.push(`What moved: ${r.moved.trim()}`);
  if (r.helped?.trim()) lines.push(`What helped: ${r.helped.trim()}`);
  if (r.in_way?.trim()) lines.push(`What got in the way: ${r.in_way.trim()}`);
  if (r.closer) lines.push(`Is ${r.stepTitle ? `"${r.stepTitle}"` : "the Next Step"} closer? ${CLOSER_WORDS[r.closer] ?? r.closer}`);
  if (r.decision) lines.push(`Next week: ${DECISION_WORDS[r.decision] ?? r.decision}`);
  const changed = (r.choices ?? []).filter((c) => c.choice !== "keep");
  for (const c of changed) lines.push(c.choice === "pause" ? `${c.name}: paused for now` : `${c.name}: smaller${c.target ? `, ${c.target}` : ""}`);
  return lines.join("\n");
}
