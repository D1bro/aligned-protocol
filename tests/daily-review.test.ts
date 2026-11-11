// The Daily Alignment's weekly review (release 2): which week it covers, the
// week's evidence from the logs (planned and what happened), "make it
// smaller", when it's due, and the review in words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewDue, reviewText, reviewWeek, smallerTarget, weekEvidence, weekOf, type ActionLog, type DailyAction } from "../lib/daily-alignment.ts";

const base: DailyAction = {
  id: "x", name: "x", measure: "done", target: null, period: "week", unit: null, life_area_id: null, goal_id: null, days: [], at_time: null,
  start_date: "2026-11-01", end_date: null, mindful: false, private: true, status: "active", run_started: null, run_paused: null, run_ended: null, position: 0,
};
const log = (action_id: string, log_date: string, p: Partial<ActionLog> = {}): ActionLog => ({ id: `${action_id}-${log_date}-${Math.random()}`, action_id, log_date, tick: false, amount: 0, seconds: 0, source: "manual", note: null, ...p });

test("early in the week it reviews last week, unless that's done; later, this week", () => {
  // Monday 16 and Wednesday 18 November: last week (from the 9th) is due.
  assert.equal(reviewWeek("2026-11-16", []), "2026-11-09");
  assert.equal(reviewWeek("2026-11-18", []), "2026-11-09");
  assert.equal(reviewWeek("2026-11-16", ["2026-11-09"]), "2026-11-16");
  // Thursday onwards: this week.
  assert.equal(reviewWeek("2026-11-19", []), "2026-11-16");
  assert.equal(reviewWeek("2026-11-15", []), "2026-11-09");
});

test("a week is named by any of its days, never one still to come", () => {
  assert.equal(weekOf("2026-11-12", "2026-11-20"), "2026-11-09");
  assert.equal(weekOf("2026-12-01", "2026-11-20"), "2026-11-16");
  assert.equal(weekOf("nonsense", "2026-11-20"), "2026-11-16");
  assert.equal(weekOf(null, "2026-11-20"), "2026-11-16");
});

test("the gym's week: what was planned and what happened, from the logs alone", () => {
  const gym = { ...base, id: "gym", name: "Gym", measure: "count" as const, target: 4, unit: "visits", days: [0, 2, 4], at_time: "07:30:00" };
  const logs = [log("gym", "2026-11-09", { amount: 1 }), log("gym", "2026-11-11", { amount: 2 }), log("gym", "2026-11-16", { amount: 1 })];
  const e = weekEvidence(gym, logs, "2026-11-09", "2026-11-20");
  assert.equal(e.plan, "4 visits a week · Monday, Wednesday and Friday · 7:30am");
  assert.equal(e.happened, "3 of 4 visits");
  assert.equal(e.daysLogged, 2);
});

test("a daily minutes target shows the week's total; manual and timer minutes add once each", () => {
  const med = { ...base, id: "med", name: "Meditation", measure: "minutes" as const, target: 10, period: "day" as const, mindful: true };
  const logs = [log("med", "2026-11-09", { seconds: 600, source: "timer" }), log("med", "2026-11-10", { seconds: 420, source: "timer" }), log("med", "2026-11-10", { seconds: 300 })];
  const e = weekEvidence(med, logs, "2026-11-09", "2026-11-11");
  assert.equal(e.plan, "10 minutes a day");
  assert.equal(e.happened, "22 minutes");
  assert.equal(e.daysLogged, 2);
});

test("yoga done twice; a run keeps its own words, never 'failed'", () => {
  const yoga = { ...base, id: "yoga", name: "Yoga", target: 3 };
  const e = weekEvidence(yoga, [log("yoga", "2026-11-09", { tick: true }), log("yoga", "2026-11-12", { tick: true })], "2026-11-09", "2026-11-20");
  assert.equal(e.happened, "2 of 3 times");
  const run = { ...base, id: "run", name: "Alcohol-free", measure: "run" as const, run_started: "2026-11-01", run_paused: "2026-11-12" };
  assert.equal(weekEvidence(run, [], "2026-11-09", "2026-11-20").happened, "Paused · Day 12");
  assert.equal(weekEvidence(run, [], "2026-11-09", "2026-11-20").plan, null);
});

test("make it smaller: about three quarters, at least one less, never below one", () => {
  assert.equal(smallerTarget(4), 3);
  assert.equal(smallerTarget(10), 7);
  assert.equal(smallerTarget(2), 1);
  assert.equal(smallerTarget(1), 1);
});

test("the review is due on the Next Step's check-in day, or on Sunday", () => {
  assert.deepEqual(reviewDue("2026-11-11", null), { date: "2026-11-15", due: false });
  assert.deepEqual(reviewDue("2026-11-15", null), { date: "2026-11-15", due: true });
  assert.deepEqual(reviewDue("2026-11-11", "2026-11-10"), { date: "2026-11-10", due: true });
});

test("the review in words, only what was answered", () => {
  const text = reviewText({
    moved: "Three gym visits", helped: "", in_way: "Late nights", closer: "closer", decision: "keep", stepTitle: "Train three times a week",
    choices: [{ name: "Gym", choice: "keep" }, { name: "Yoga", choice: "smaller", target: 2 }, { name: "Reading", choice: "pause" }],
  });
  assert.equal(text, [
    "What moved: Three gym visits",
    "What got in the way: Late nights",
    'Is "Train three times a week" closer? Closer',
    "Next week: Keep it",
    "Yoga: smaller, 2",
    "Reading: paused for now",
  ].join("\n"));
  assert.equal(reviewText({}), "");
});
