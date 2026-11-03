import { test } from "node:test";
import assert from "node:assert/strict";
import { intentionSuggestions, monthStart, weekProgress, weekStartOf } from "../lib/planning.ts";

test("months start on the first, weeks on Monday", () => {
  assert.equal(monthStart("2026-11-03"), "2026-11-01");
  assert.equal(weekStartOf("2026-11-03"), "2026-11-02"); // a Tuesday
  assert.equal(weekStartOf("2026-11-02"), "2026-11-02"); // a Monday
  assert.equal(weekStartOf("2026-11-08"), "2026-11-02"); // a Sunday
  assert.equal(weekStartOf("2027-01-01"), "2026-12-28"); // across the year
});

test("the week's progress counts planned days and their own actions", () => {
  const week = "2026-11-02";
  // Planned for Sunday only; nothing ticked yet.
  assert.deepEqual(weekProgress(week, [6], []), { done: 0, total: 1 });
  // Ticked on Sunday, plus two of their own (one done), plus last week's.
  const actions = [
    { action_date: "2026-11-08", source: "plan" as const, done_at: "2026-11-08T18:30:00Z" },
    { action_date: "2026-11-03", source: "own" as const, done_at: "2026-11-03T09:00:00Z" },
    { action_date: "2026-11-04", source: "own" as const, done_at: null },
    { action_date: "2026-10-31", source: "own" as const, done_at: "2026-10-31T09:00:00Z" },
  ];
  assert.deepEqual(weekProgress(week, [6], actions), { done: 2, total: 3 });
  // Ticking the plan's action on an unplanned day still counts it once.
  assert.deepEqual(weekProgress(week, [6], [{ action_date: "2026-11-05", source: "plan", done_at: "2026-11-05T08:00:00Z" }]), { done: 1, total: 2 });
});

test("intention suggestions come from their goals and stay short", () => {
  const s = intentionSuggestions([{ area: "Money & Stability", title: "Check my spending every Sunday." }]);
  assert.deepEqual(s, [
    "Steady progress with money & stability, one week at a time",
    "Keep my promise: Check my spending every Sunday",
    "Present, patient and kind to myself",
  ]);
  assert.equal(intentionSuggestions([]).length, 1);
});

test("after a new audit, suggestions explain what changed and never decide for them", async () => {
  const { auditSuggestions } = await import("../lib/planning.ts");
  const areas = [{ id: "m", name: "Money & Stability" }, { id: "h", name: "Health" }, { id: "r", name: "Relationships" }];
  const before = new Map([["m", 4], ["h", 7], ["r", 6]]);
  const reached = auditSuggestions({ area: areas[0], target: 5, areas, before, after: new Map([["m", 5], ["h", 7], ["r", 6]]) });
  assert.deepEqual(reached.map((s) => s.key), ["reached"]);
  const dropped = auditSuggestions({ area: areas[0], target: 5, areas, before, after: new Map([["m", 3], ["h", 4], ["r", 5]]) });
  assert.deepEqual(dropped.map((s) => s.key), ["dropped", "elsewhere"]);
  assert.match(dropped[1].text, /^Health has gone from 7 to 4/);
  const steady = auditSuggestions({ area: areas[0], target: 6, areas, before, after: new Map([["m", 5], ["h", 6], ["r", 6]]) });
  assert.deepEqual(steady.map((s) => s.key), ["keep"]);
});
