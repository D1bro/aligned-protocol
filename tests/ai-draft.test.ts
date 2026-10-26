import { test } from "node:test";
import assert from "node:assert/strict";
import { tidyDraft, type AiDraft } from "../lib/ai-draft.ts";

const AREAS = ["Health & Energy", "Money & Stability"];

function draft(patch: Partial<AiDraft> = {}): AiDraft {
  return {
    focus: "Money",
    summary: "You talked about money.",
    insights: [],
    client_actions: [{ text: "Check the account weekly", due_date: "2026-11-02", goal_id: "g1", source_excerpt: "", source_time: "", uncertain: false }],
    coach_actions: [],
    next_meeting: { mentioned: true, text: "Next Tuesday at 10", source_excerpt: "", date: "2026-11-03", time: "10:00", duration_minutes: 60 },
    review_flags: [],
    coach_note: "Avoids looking at statements.",
    suggested_focus: { area: "Money & Stability", goal: "Know where my money goes", why: "You said it worries you most." },
    prep: ["How the weekly check went"],
    ...patch,
  };
}

test("a well-formed draft passes through unchanged", () => {
  const d = tidyDraft(draft(), ["g1"], AREAS);
  assert.equal(d.client_actions[0].goal_id, "g1");
  assert.equal(d.next_meeting.date, "2026-11-03");
  assert.equal(d.next_meeting.time, "10:00");
  assert.equal(d.next_meeting.duration_minutes, 60);
  assert.equal(d.suggested_focus.area, "Money & Stability");
  assert.deepEqual(d.prep, ["How the weekly check went"]);
});

test("goal links to goals the client doesn't have are dropped", () => {
  assert.equal(tidyDraft(draft(), ["other"], AREAS).client_actions[0].goal_id, "");
});

test("vague or malformed meeting times never become a booking", () => {
  const d = tidyDraft(draft({ next_meeting: { mentioned: true, text: "sometime soon", source_excerpt: "", date: "next week", time: "10am", duration_minutes: 1000 } }), [], AREAS);
  assert.equal(d.next_meeting.date, "");
  assert.equal(d.next_meeting.time, "");
  assert.equal(d.next_meeting.duration_minutes, 0);
  assert.equal(d.next_meeting.text, "sometime soon");
  assert.equal(tidyDraft(draft({ next_meeting: { ...draft().next_meeting, time: "24:30" } }), [], AREAS).next_meeting.time, "");
});

test("an area that isn't one of the ten clears the whole suggestion", () => {
  const d = tidyDraft(draft({ suggested_focus: { area: "Finances", goal: "x", why: "y" } }), [], AREAS);
  assert.deepEqual(d.suggested_focus, { area: "", goal: "", why: "" });
});

test("prep is trimmed to five real items", () => {
  const d = tidyDraft(draft({ prep: ["a", "", "  ", "b", "c", "d", "e", "f"] }), [], AREAS);
  assert.deepEqual(d.prep, ["a", "b", "c", "d", "e"]);
});
