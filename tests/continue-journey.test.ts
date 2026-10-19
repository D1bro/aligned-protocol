import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAfterJoining } from "../lib/continue-journey.ts";

test("a new profile with a starting point goes into its first plan", () => {
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "chosen" }), "/clear?welcome=1");
});

test("a plan already under way carries on without the welcome", () => {
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "in_progress" }), "/clear");
});

test("no starting point, no audit, or a finished plan lands on My profile", () => {
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "none" }), "/");
  assert.equal(nextAfterJoining({ hasAudit: false, plan: "none" }), "/");
  assert.equal(nextAfterJoining({ hasAudit: true, plan: "done" }), "/");
});
