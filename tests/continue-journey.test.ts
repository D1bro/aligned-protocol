import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAfterJoining } from "../lib/continue-journey.ts";

test("a new profile with a starting point, or a plan under way, goes into the plan", () => {
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "chosen" }), "/plan?latest=1");
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "in_progress" }), "/plan?latest=1");
});

test("a plan built as a guest lands on My Space, saved", () => {
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "done" }), "/?welcome=plan");
});

test("no starting point or no audit lands on My Space", () => {
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "none" }), "/?welcome=saved");
  assert.equal(nextAfterJoining({ hasAudit: false, plan: "none" }), "/");
});
