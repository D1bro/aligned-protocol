import { test } from "node:test";
import assert from "node:assert/strict";
import { countdown, daysUntil, shortDayTime, stepStates, stepTally, weekStreak } from "../lib/momentum.ts";

const now = new Date("2026-11-05T12:00:00Z"); // Thursday, UK
const upd = (commitment_id: string, progress: string, created_at: string) => ({ commitment_id, progress, created_at });

test("each step takes its latest update; the coach marking it done counts", () => {
  const steps = [
    { id: "a", status: "open" },
    { id: "b", status: "open" },
    { id: "c", status: "done" },
    { id: "d", status: "open" },
  ];
  const updates = [upd("a", "tried", "2026-11-04T10:00:00Z"), upd("b", "not_yet", "2026-11-04T09:00:00Z"), upd("a", "done", "2026-11-01T09:00:00Z")];
  const states = stepStates(steps, updates);
  assert.deepEqual(states, ["moving", "none", "done", "none"]);
  assert.deepEqual(stepTally(states), { total: 4, moved: 2, done: 1 });
});

test("a run of weeks counts back from this week, or last week if this one is quiet so far", () => {
  const at = (d: string) => ({ created_at: `${d}T10:00:00Z` });
  // This week (from Mon 2 Nov), the week before and the one before that.
  assert.deepEqual(weekStreak([at("2026-11-03"), at("2026-10-28"), at("2026-10-19")], now), {
    streak: 3,
    weeks: [false, false, false, true, true, true],
  });
  // Nothing yet this week: the run from last week still stands.
  assert.equal(weekStreak([at("2026-10-28"), at("2026-10-20")], now).streak, 2);
  // A gap breaks it.
  assert.equal(weekStreak([at("2026-11-02"), at("2026-10-20")], now).streak, 1);
  assert.equal(weekStreak([], now).streak, 0);
  // Sunday night in London is still the same week.
  assert.equal(weekStreak([{ created_at: "2026-11-01T23:30:00Z" }, at("2026-10-20")], now).streak, 2);
});

test("the countdown is in calendar days in the session's time zone", () => {
  assert.equal(countdown(daysUntil("2026-11-09T10:00:00Z", "Europe/London", now)), "4 days");
  assert.equal(countdown(daysUntil("2026-11-06T08:00:00Z", "Europe/London", now)), "Tomorrow");
  assert.equal(countdown(daysUntil("2026-11-05T18:00:00Z", "Europe/London", now)), "Today");
  assert.equal(shortDayTime("2026-11-09T10:00:00Z", "Europe/London"), "Mon 9 Nov · 10:00");
});
