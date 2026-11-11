// The Next Step's helpers: when a Next Step counts as set, where setting one
// picks up, and that every area has its own prompts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aScore, isSet, looksLikeSeveral, movesRepeat, promptsFor, resumeScreen, stepName, stepsBetween, weekDays, whyLine } from "../lib/next-step.ts";

const AREAS = [
  "Health & Energy", "Mindset & Thinking", "Confidence & Self-Belief", "Relationships & Connection", "Career, Work & Business",
  "Money & Stability", "Purpose & Direction", "Daily Structure & Discipline", "Emotional Wellbeing", "Self-Respect & Identity",
];

test("a Next Step is set once taken on, and an old finished plan counts too", () => {
  assert.equal(isSet(null), false);
  assert.equal(isSet({ set_at: "2026-11-10T10:00:00Z" }), true);
  assert.equal(isSet({ frequency: "Weekly", success_criteria: "Four Sundays in a row" }), true);
  assert.equal(isSet({ frequency: "Weekly", success_criteria: " " }), false);
});

test("setting one picks up at the first screen not done", () => {
  assert.equal(resumeScreen({}, null, 0), 1);
  assert.equal(resumeScreen({ current_reality: "Tight" }, null, 0), 2);
  assert.equal(resumeScreen({ current_reality: "Tight", life_vision: "Calm" }, null, 0), 3);
  const goal = { goal_title: "Sign one client", aim_score: 5, motivation_text: "The bills" };
  assert.equal(resumeScreen({}, goal, 0), 4);
  assert.equal(resumeScreen({}, { ...goal, in_the_way: "Asking" }, 0), 5);
  assert.equal(resumeScreen({}, { ...goal, in_the_way: "Asking", success_criteria: "Signed" }, 1), 6);
});

test("every area has its own questions and examples, still only questions", () => {
  for (const area of AREAS) {
    const p = promptsFor(area);
    assert.equal(p.ten.length, 4, area);
    assert.equal(p.way.length, 4, area);
    assert.ok(p.ten[0].endsWith("?") && p.way[0].endsWith("?"), area);
    assert.notEqual(p.examples.step, promptsFor("Unknown area").examples.step, area);
  }
});

test("wording helpers", () => {
  assert.equal(aScore(8), "an 8");
  assert.equal(aScore(5), "a 5");
  assert.equal(stepsBetween(4, 5), "one step");
  assert.equal(stepsBetween(3, 6), "3 steps");
});

test("a move repeats only when it says so; a day on its own is a deadline", () => {
  assert.equal(movesRepeat("Every Sunday at 6pm"), true);
  assert.equal(movesRepeat("each Monday"), true);
  assert.equal(movesRepeat("Daily"), true);
  assert.equal(movesRepeat("By Friday"), false);
  assert.equal(movesRepeat("Today"), false);
  assert.equal(movesRepeat(null), false);
});

test("a step that reads like several gets the gentle nudge; one clear step doesn't", () => {
  assert.equal(looksLikeSeveral("Launch each of the businesses with complete sales systems and work through it with each of the leaders"), true);
  assert.equal(looksLikeSeveral("Sign one client at £2,000 a month"), false);
  assert.equal(looksLikeSeveral("Decide whether to stay in the job"), false);
  assert.equal(looksLikeSeveral(""), false);
  // "each" on its own is one step done regularly, not several (11 Nov 2026).
  assert.equal(looksLikeSeveral("Protect 45 minutes each morning for the book"), false);
  assert.equal(looksLikeSeveral("Call each of my three biggest clients"), true);
});

test("a Next Step goes by its short name when it has one", () => {
  assert.equal(stepName({ step_name: "The Aligned sells on its own", goal_title: "Launch The Aligned with a complete sales system" }), "The Aligned sells on its own");
  assert.equal(stepName({ step_name: "  ", goal_title: "Sign one client" }), "Sign one client");
  assert.equal(stepName({ goal_title: "Sign one client" }), "Sign one client");
});

test("the why is kept to its first sentence, and short", () => {
  assert.equal(whyLine("It would take away the persistent dark cloud. And more besides."), "It would take away the persistent dark cloud.");
  assert.equal(whyLine(null), null);
  const long = whyLine("word ".repeat(80), 40)!;
  assert.ok(long.length <= 40 && long.endsWith("…"));
});

test("a week runs Monday to Sunday with the ticked days and today marked", () => {
  const w = weekDays("2026-11-09", ["2026-11-09", "2026-11-10"], "2026-11-11");
  assert.deepEqual(w.map((d) => d.letter).join(""), "MTWTFSS");
  assert.deepEqual(w.map((d) => d.done), [true, true, false, false, false, false, false]);
  assert.equal(w.find((d) => d.today)?.date, "2026-11-11");
  assert.deepEqual(w.map((d) => d.future), [false, false, false, true, true, true, true]);
});
