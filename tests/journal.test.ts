import { test } from "node:test";
import assert from "node:assert/strict";
import { byMonth, checkVideoUrl, ownImages, planPrompts, todaysPrompt, PROMPTS, videoSite } from "../lib/journal.ts";

test("today's prompt is the same all day and comes from the list", () => {
  assert.equal(todaysPrompt("2026-11-03"), todaysPrompt("2026-11-03"));
  assert.ok(PROMPTS.includes(todaysPrompt("2026-11-03")));
  assert.notEqual(todaysPrompt("2026-11-03"), todaysPrompt("2026-11-04"));
});

test("prompts from their plan quote their own words, briefly", () => {
  assert.deepEqual(planPrompts({ focus: "Check my spending on Sunday.", intention: "Calm about money" }), [
    "How did “Check my spending on Sunday” go this week?",
    "Is this month living up to “Calm about money”?",
  ]);
  assert.deepEqual(planPrompts({ focus: null, intention: "  " }), []);
  assert.match(planPrompts({ focus: "x".repeat(100), intention: null })[0], /…” go this week\?$/);
});

test("video links are https and shown by site", () => {
  assert.deepEqual(checkVideoUrl(""), { ok: true, value: null });
  assert.deepEqual(checkVideoUrl(" https://youtu.be/abc "), { ok: true, value: "https://youtu.be/abc" });
  assert.equal(checkVideoUrl("http://example.com/v").ok, false);
  assert.equal(checkVideoUrl("not a link").ok, false);
  assert.equal(videoSite("https://www.youtube.com/watch?v=abc"), "YouTube");
  assert.equal(videoSite("https://vimeo.com/123"), "Vimeo");
  assert.equal(videoSite("https://example.org/clip"), "example.org");
});

test("images must be their own, four at most", () => {
  assert.deepEqual(ownImages(["u1/a.jpg"], "u1"), ["u1/a.jpg"]);
  assert.equal(ownImages(["u2/a.jpg"], "u1"), null);
  assert.equal(ownImages(["u1/../u2/a.jpg"], "u1"), null);
  assert.equal(ownImages(["u1/1", "u1/2", "u1/3", "u1/4", "u1/5"], "u1"), null);
});

test("entries are grouped by month, newest first", () => {
  const g = byMonth([{ entry_date: "2026-11-03" }, { entry_date: "2026-11-01" }, { entry_date: "2026-10-28" }]);
  assert.deepEqual(g.map((x) => [x.month, x.entries.length]), [["2026-11", 2], ["2026-10", 1]]);
});
