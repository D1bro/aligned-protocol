// The Daily Alignment's evidence (Duane's build brief v1, 11 Nov 2026):
// neutral lines, runs that pause rather than fail, a timer from stored
// times, mindful minutes from mindful actions only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dueOn, mindfulOf, progressOf, runDays, scheduleLabel, timerState, weekStrip, welcomeBack, type ActionLog, type DailyAction } from "../lib/daily-alignment.ts";

const base: DailyAction = {
  id: "x", name: "x", measure: "done", target: null, period: "week", unit: null, life_area_id: null, goal_id: null, days: [], at_time: null,
  start_date: "2026-11-01", end_date: null, mindful: false, private: true, status: "active", run_started: null, run_paused: null, run_ended: null, position: 0,
};
const log = (action_id: string, log_date: string, p: Partial<ActionLog> = {}): ActionLog => ({ id: `${action_id}-${log_date}-${Math.random()}`, action_id, log_date, tick: false, amount: 0, seconds: 0, source: "manual", note: null, ...p });

// Wednesday 11 November 2026; the week starts Monday 9th.
const today = "2026-11-11";

test("the gym: 2 of 4 visits this week, and its schedule with the exact time", () => {
  const gym = { ...base, id: "gym", name: "Gym", measure: "count" as const, target: 4, unit: "visits", days: [0, 2, 4], at_time: "07:30:00" };
  const logs = [log("gym", "2026-11-09", { amount: 1 }), log("gym", "2026-11-11", { amount: 1 }), log("gym", "2026-11-06", { amount: 1 })];
  assert.equal(progressOf(gym, logs, today).line, "2 of 4 visits this week");
  assert.equal(scheduleLabel(gym), "Monday, Wednesday and Friday · 7:30am");
  assert.equal(dueOn(gym, today), true);
  assert.equal(dueOn(gym, "2026-11-12"), false);
  assert.equal(dueOn({ ...gym, status: "paused" }, today), false);
});

test("meditation: actual minutes, today and this week, never the planned time", () => {
  const med = { ...base, id: "med", name: "Meditation", measure: "minutes" as const, target: 60, mindful: true };
  const logs = [log("med", today, { seconds: 420, source: "timer" }), log("med", today, { seconds: 300 }), log("med", "2026-11-09", { seconds: 2040 })];
  assert.equal(progressOf(med, logs, today).line, "12 minutes today · 46 of 60 minutes this week");
  assert.equal(progressOf({ ...med, target: 10, period: "day" }, [log("med", today, { seconds: 420 })], today).line, "7 of 10 minutes today");
  const m = mindfulOf([med, { ...base, id: "yoga", measure: "minutes" }], [...logs, log("yoga", today, { seconds: 1800 })], today);
  assert.deepEqual([m.todaySeconds, m.weekSeconds, m.sessions], [720, 2760, 3]);
});

test("yoga by completion: one tick a day, counted for the week", () => {
  const yoga = { ...base, id: "yoga", name: "Yoga", target: 3, unit: "sessions" };
  const logs = [log("yoga", "2026-11-10", { tick: true })];
  assert.equal(progressOf(yoga, logs, today).line, "1 of 3 sessions this week");
  assert.equal(progressOf(yoga, logs, today).doneToday, false);
});

test("a current run pauses and ends, never fails", () => {
  const run = { ...base, measure: "run" as const, run_started: "2026-10-25" };
  assert.equal(runDays(run, today), 18);
  assert.equal(progressOf(run, [], today).line, "Day 18");
  assert.equal(progressOf({ ...run, run_paused: "2026-11-05" }, [], today).line, "Paused · Day 12");
  assert.equal(progressOf({ ...run, run_ended: "2026-11-05" }, [], today).line, "Ended at 12 days");
  assert.equal(dueOn({ ...run, run_ended: "2026-11-05" }, today), false);
});

test("the timer is worked out from stored times", () => {
  const start = Date.parse("2026-11-11T07:00:00Z");
  const t = { action_id: "med", planned_seconds: 600, started_at: "2026-11-11T07:00:00Z", paused_at: null, paused_seconds: 0, intention: null };
  assert.deepEqual(timerState(t, start + 420_000), { elapsed: 420, remaining: 180, paused: false, finished: false, endsAt: start + 600_000 });
  // Back after the end: complete, and it stops at the planned length.
  assert.equal(timerState(t, start + 3_600_000).finished, true);
  assert.equal(timerState(t, start + 3_600_000).elapsed, 600);
  // Paused: the clock stands still however long it's left.
  const paused = { ...t, paused_at: "2026-11-11T07:05:00Z", paused_seconds: 60 };
  assert.equal(timerState(paused, start + 9_999_000).elapsed, 240);
});

test("the week as evidence, and welcome back after a gap", () => {
  const gym = { ...base, id: "gym", measure: "count" as const, days: [0, 2, 4] };
  const any = { ...base, id: "walk" };
  const strip = weekStrip([gym, any], [log("gym", "2026-11-09", { amount: 1 }), log("walk", "2026-11-10", { tick: true })], today);
  assert.deepEqual(strip.map((d) => [d.letter, d.done, d.planned]), [["M", 1, 1], ["T", 1, 0], ["W", 0, 1], ["T", 0, 0], ["F", 0, 1], ["S", 0, 0], ["S", 0, 0]]);
  assert.equal(welcomeBack("2026-11-09", today), true);
  assert.equal(welcomeBack("2026-11-10", today), false);
  assert.equal(welcomeBack(null, today), false);
});
