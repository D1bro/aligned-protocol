import { test } from "node:test";
import assert from "node:assert/strict";
import { tidyDraft, tidyReflection, quoteIsReal, type AiDraft, type Reflection } from "../lib/ai-draft.ts";

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

const TRANSCRIPT = `[52:10] Coach: When I was younger I kept people at arm's length too.
[52:29] Client: I think I do the same. When there is closeness, it can feel a bit, like…
[53:00] Coach: Shall we come back to that?`;

function reflection(): Reflection {
  return {
    movements: [
      { time: "52:29", client_words: "I think I do the same", what_moved: "Named his own pattern", coach_move: "story", coach_move_time: "52:10", coach_move_note: "Coach's own story" },
      { time: "50:00", client_words: "I never said this sentence", what_moved: "x", coach_move: "question", coach_move_time: "", coach_move_note: "" },
      { time: "", client_words: "I think I do the same", what_moved: "no timestamp", coach_move: "story", coach_move_time: "", coach_move_note: "" },
    ],
    unfinished: [{ time: "52:29", client_words: "When there is closeness, it can feel a bit, like...", note: "Not followed up" }],
    patterns: [
      { pattern: "Opens up after the coach goes first", evidence_times: ["52:10", "52:29"], note: "" },
      { pattern: "No evidence given", evidence_times: [], note: "" },
    ],
    challenge: { text: "Let him go first next time.", evidence_times: ["52:29"] },
  };
}

test("reflection keeps only quotes that are really in the transcript, with timestamps", () => {
  const r = tidyReflection(reflection(), TRANSCRIPT);
  assert.equal(r.movements.length, 1);
  assert.equal(r.movements[0].coach_move, "story");
  assert.equal(r.unfinished.length, 1, "a trailing ellipsis still matches the real words");
  assert.equal(r.patterns.length, 1, "patterns need evidence timestamps");
  assert.equal(r.challenge.text, "Let him go first next time.");
});

test("a challenge without evidence is dropped, and unknown moves become 'other'", () => {
  const raw = reflection();
  raw.challenge = { text: "Talk less.", evidence_times: [] };
  raw.movements[0].coach_move = "monologue" as never;
  const r = tidyReflection(raw, TRANSCRIPT);
  assert.equal(r.challenge.text, "");
  assert.equal(r.movements[0].coach_move, "other");
});

test("quote matching ignores case and punctuation but not invented words", () => {
  assert.ok(quoteIsReal("i think, I do the same!", TRANSCRIPT));
  assert.ok(!quoteIsReal("I think I do the same thing", TRANSCRIPT));
  assert.ok(!quoteIsReal("", TRANSCRIPT));
});
