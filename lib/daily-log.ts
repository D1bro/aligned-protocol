// The daily log (Duane, 10 Nov 2026): Today on My Space shows every move due
// that day and every session action due, each with its own tick. The ticks
// are the log: they fill each move's week, count towards "Done when", and
// fill the coach's "Since last time". Pure helpers, so they can be tested;
// the reads and writes are in lib/actions. Dates are YYYY-MM-DD calendar
// days; weekdays are 0 = Monday … 6 = Sunday.

const DAY_WORDS: [RegExp, number][] = [
  [/\bmon(day)?s?\b/i, 0],
  [/\btue(s|sday)?s?\b/i, 1],
  [/\bwed(s|nesday)?s?\b/i, 2],
  [/\bthu(r|rs|rsday)?s?\b/i, 3],
  [/\bfri(day)?s?\b/i, 4],
  [/\bsat(urday)?s?\b/i, 5],
  [/\bsun(day)?s?\b/i, 6],
];

// When a move happens, read from what they wrote: the days it repeats on
// ("Monday and Thursday", "Sundays", "every day", "weekdays"), or none for a
// one-off ("By Friday", "This Saturday", "Friday 14th", "Once I'm paid").
export function moveDays(whenText: string | null | undefined): number[] {
  const w = (whenText ?? "").toLowerCase();
  if (!w.trim()) return [];
  if (/\b(every ?day|daily|each day|every night|nightly|every morning|every evening)\b/.test(w)) return [0, 1, 2, 3, 4, 5, 6];
  const days = new Set<number>();
  if (/\bweekdays\b/.test(w)) [0, 1, 2, 3, 4].forEach((d) => days.add(d));
  if (/\bweekends\b/.test(w)) [5, 6].forEach((d) => days.add(d));
  for (const [re, d] of DAY_WORDS) if (re.test(w)) days.add(d);
  if (!days.size) return [];
  const saysRepeat = /\b(every|each)\b/.test(w) || /(mon|tues|wednes|thurs|fri|satur|sun|week)days\b|weekends\b/.test(w);
  const saysOnce = /\b(by|before|until|this|next)\s+(mon|tue|wed|thu|fri|sat|sun)/.test(w) || /\b\d{1,2}(st|nd|rd|th)\b|\b\d{1,2}\/\d{1,2}\b/.test(w);
  if (saysOnce && !saysRepeat) return [];
  return [...days].sort((a, b) => a - b);
}

export const repeats = (whenText: string | null | undefined) => moveDays(whenText).length > 0;

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
const ymdOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
export const weekdayOf = (ymd: string) => (new Date(dayNumber(ymd) * 86_400_000).getUTCDay() + 6) % 7;
export const addDays = (ymd: string, n: number) => ymdOf(dayNumber(ymd) + n);

// "Monday and Thursday", "Every day", "Weekdays"
const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function daysLabel(days: number[]): string {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && days.every((d, i) => d === i)) return "Weekdays";
  if (days.length === 2 && days[0] === 5 && days[1] === 6) return "Weekends";
  const names = days.map((d) => NAMES[d]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export type LogMove = { id: string; goal_id: string; body: string; when_text: string | null; done_at: string | null; created_at?: string | null };
export type MoveTick = { move_id: string | null; action_date: string; done_at: string | null };

export type TodayMove = {
  moveId: string;
  goalId: string;
  body: string;
  when: string;
  // A repeating move is ticked for today; a one-off is ticked off for good.
  kind: "repeat" | "once";
  done: boolean;
};

// The moves to show in Today: each repeating move due today, and each
// one-off until it's done (and on the day it was done, so the tick stays).
export function movesForToday(moves: LogMove[], ticks: MoveTick[], today: string, doneDay: (iso: string) => string): TodayMove[] {
  const todayWeekday = weekdayOf(today);
  const out: TodayMove[] = [];
  for (const m of moves) {
    const days = moveDays(m.when_text);
    if (days.length) {
      if (!days.includes(todayWeekday)) continue;
      const done = ticks.some((t) => t.move_id === m.id && t.action_date === today && t.done_at);
      out.push({ moveId: m.id, goalId: m.goal_id, body: m.body, when: daysLabel(days), kind: "repeat", done });
    } else if (!m.done_at || doneDay(m.done_at) === today) {
      out.push({ moveId: m.id, goalId: m.goal_id, body: m.body, when: m.when_text?.trim() || "", kind: "once", done: !!m.done_at });
    }
  }
  return out;
}

// One move's days in a stretch of dates: planned (a day it repeats on, from
// the day the move was added) and done (ticked). A one-off is planned on no
// day and done on the day it was.
export type LogDay = { date: string; letter: string; planned: boolean; done: boolean; today: boolean; future: boolean };
export function moveLog(move: LogMove, ticks: MoveTick[], from: string, days: number, today: string, doneDay: (iso: string) => string): LogDay[] {
  const planned = moveDays(move.when_text);
  const doneDates = new Set(ticks.filter((t) => t.move_id === move.id && t.done_at).map((t) => t.action_date));
  if (move.done_at && !planned.length) doneDates.add(doneDay(move.done_at));
  const added = move.created_at ? doneDay(move.created_at) : null;
  const out: LogDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const wd = weekdayOf(date);
    const planned_ = planned.includes(wd) && (!added || date >= added);
    out.push({ date, letter: "MTWTFSS"[wd], planned: planned_, done: doneDates.has(date), today: date === today, future: date > today });
  }
  return out;
}

// "3 of 8": ticks of the counted move since the Next Step was set.
export function countProgress(
  goal: { count_target?: number | null; count_move_id?: string | null; set_at?: string | null },
  ticks: MoveTick[],
  setDay: string | null
): { done: number; target: number } | null {
  if (!goal.count_target || !goal.count_move_id) return null;
  const done = new Set(ticks.filter((t) => t.move_id === goal.count_move_id && t.done_at && (!setDay || t.action_date >= setDay)).map((t) => t.action_date)).size;
  return { done, target: goal.count_target };
}

// Session actions in Today: the member's open actions that are linked to a
// Next Step under way (until they're done), or due today or earlier.
export type SessionAction = { id: string; summary_id: string; owner: string; body: string; due_date: string | null; status: string; goal_id: string | null };
export type ActionUpdate = { commitment_id: string; progress: string; created_at: string };
export type TodayAction = { id: string; body: string; due: string | null; linked: boolean; done: boolean; late: boolean };

export function latestProgress(updates: ActionUpdate[], id: string): ActionUpdate | null {
  return updates.filter((u) => u.commitment_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function actionsForToday(actions: SessionAction[], updates: ActionUpdate[], activeGoalIds: string[], today: string, doneDay: (iso: string) => string): TodayAction[] {
  const out: TodayAction[] = [];
  for (const a of actions) {
    if (a.owner !== "client" || a.status !== "open") continue;
    const last = latestProgress(updates, a.id);
    const done = last?.progress === "done";
    // Done before today: off the list. Done today: stays, ticked.
    if (done && doneDay(last!.created_at) !== today) continue;
    const linked = !!a.goal_id && activeGoalIds.includes(a.goal_id);
    const due = !!a.due_date && a.due_date <= today;
    if (!linked && !due) continue;
    out.push({ id: a.id, body: a.body, due: a.due_date, linked, done, late: !!a.due_date && a.due_date < today && !done });
  }
  return out;
}

// The week's progress from the daily log, counted, never estimated: each day
// a move repeats on is one, each one-off done this week is one, and each
// action they added is one.
export function weekLogProgress(
  moves: LogMove[],
  actions: { move_id?: string | null; action_date: string; source: string; done_at: string | null; goal_id: string | null }[],
  weekStart: string,
  _goalId: string,
  doneDay: (iso: string) => string
): { done: number; total: number } {
  const end = addDays(weekStart, 7);
  const inWeek = actions.filter((a) => a.action_date >= weekStart && a.action_date < end);
  let total = 0;
  let done = 0;
  for (const m of moves) {
    const days = moveDays(m.when_text);
    if (days.length) {
      const added = m.created_at ? doneDay(m.created_at) : null;
      const plannedDays = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i)).filter((d) => days.includes(weekdayOf(d)) && (!added || d >= added)).length;
      total += plannedDays;
      done += Math.min(plannedDays, inWeek.filter((a) => a.source === "move" && a.move_id === m.id && a.done_at).length);
    } else if (m.done_at && doneDay(m.done_at) >= weekStart && doneDay(m.done_at) < end) {
      total += 1;
      done += 1;
    }
  }
  const own = inWeek.filter((a) => a.source === "own");
  total += own.length;
  done += own.filter((a) => a.done_at).length;
  return { done, total };
}
