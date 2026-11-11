// The live site leaves out content Duane hasn't approved (11 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.VERCEL_ENV = "production";
const c = await import("../lib/learn-content.ts");

test("on the live site, drafts and unrecorded episodes are left out", () => {
  assert.equal(c.SHOW_DRAFTS, false);
  assert.ok(c.SHOWN_PATHS.every((p) => p.lessons.length > 0 && p.lessons.every((l) => !l.draft)));
  assert.ok(c.SHOWN_MUSINGS.every((m) => !m.draft));
  assert.ok(c.SHOWN_EPISODES.every((e) => !e.draft && (e.audio || e.video)));
  assert.equal(c.TEN_AREAS_SHOWN, c.TEN_AREAS_APPROVED);
  // A section with nothing approved drops out of the menu.
  assert.equal(c.EMPTY_SECTIONS.includes("/learn"), c.SHOWN_PATHS.length === 0);
  assert.equal(c.EMPTY_SECTIONS.includes("/musings"), c.SHOWN_MUSINGS.length === 0);
  assert.equal(c.EMPTY_SECTIONS.includes("/podcast"), c.SHOWN_EPISODES.length === 0);
  // A lesson that isn't shown can't be opened.
  const draft = c.PATHS.flatMap((p) => p.lessons.map((l) => [p.slug, l] as const)).find(([, l]) => l.draft);
  if (draft) assert.equal(c.findLesson(draft[0], draft[1].slug), null);
});
