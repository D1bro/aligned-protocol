import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAfterJoining } from "../lib/continue-journey.ts";

test("a new profile with a starting point, or a plan under way, goes into the plan", () => {
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "chosen" }), "/clear?latest=1");
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "in_progress" }), "/clear?latest=1");
});

test("a plan built as a guest lands on My profile, saved", () => {
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "done" }), "/?welcome=plan");
});

test("no starting point or no audit lands on My profile", () => {
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "none" }), "/");
  assert.equal(nextAfterJoining({ hasAudit: false, plan: "none" }), "/");
});
