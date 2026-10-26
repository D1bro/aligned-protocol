import { BUSINESS_TZ, localDate } from "./time.ts";

// The client's momentum on the Coaching page and My profile: how far the
// steps from their last session have moved, how many weeks in a row they've
// updated a step, and how long until the next session. Worked out from data
// they already have; nothing is stored.

export type StepState = "done" | "moving" | "none";
type Update = { commitment_id: string; progress: string; created_at: string };

// Where each step stands, from its latest update (updates arrive newest
// first). A step the coach has marked done counts as done.
export function stepStates(steps: { id: string; status: string }[], updates: Update[]): StepState[] {
  return steps.map((s) => {
    const p = updates.find((u) => u.commitment_id === s.id)?.progress;
    if (p === "done" || (!p && s.status === "done")) return "done";
    return p === "tried" || p === "partly" ? "moving" : "none";
  });
}

export function stepTally(states: StepState[]) {
  const done = states.filter((s) => s === "done").length;
  return { total: states.length, moved: done + states.filter((s) => s === "moving").length, done };
}

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

// The Monday that starts the week a date falls in, as a day number.
const weekOf = (ymd: string) => {
  const n = dayNumber(ymd);
  return n - ((new Date(n * 86_400_000).getUTCDay() + 6) % 7);
};

// Weeks (Monday to Sunday) in a row with at least one step update. A run
// still counts while this week has none yet, so it doesn't break on a Monday
// morning. `weeks` marks the last few weeks, oldest first.
export function weekStreak(updates: { created_at: string }[], now: Date = new Date(), timeZone = BUSINESS_TZ, shown = 6) {
  const active = new Set(updates.map((u) => weekOf(localDate(u.created_at, timeZone))));
  const thisWeek = weekOf(localDate(now, timeZone));
  const weeks = Array.from({ length: shown }, (_, i) => active.has(thisWeek - 7 * (shown - 1 - i)));
  let week = active.has(thisWeek) ? thisWeek : thisWeek - 7;
  let streak = 0;
  while (active.has(week)) {
    streak++;
    week -= 7;
  }
  return { streak, weeks };
}

// Calendar days from today to the session, in the session's time zone.
export function daysUntil(instant: Date | string, timeZone = BUSINESS_TZ, now: Date = new Date()): number {
  return dayNumber(localDate(instant, timeZone)) - dayNumber(localDate(now, timeZone));
}

export function countdown(days: number): string {
  if (days <= 0) return "Today";
  return days === 1 ? "Tomorrow" : `${days} days`;
}

// "Mon 9 Nov · 10:00"
export function shortDayTime(instant: Date | string, timeZone = BUSINESS_TZ): string {
  const d = new Date(instant);
  const day = d.toLocaleDateString("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  return `${day} · ${d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
}
