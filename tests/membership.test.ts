import { test } from "node:test";
import assert from "node:assert/strict";
import { bestAccess, hasMomentum, hasPractice, membershipsOpen, statusWords } from "../lib/membership.ts";

test("the best membership wins, then the one that lasts longest", () => {
  assert.deepEqual(bestAccess([]), { tier: "clarity", source: null, until: null });
  assert.deepEqual(
    bestAccess([
      { tier: "practice", source: "subscription", until: "2026-12-01T00:00:00Z" },
      { tier: "momentum", source: "package", until: "2026-11-20T00:00:00Z" },
    ]),
    { tier: "momentum", source: "package", until: "2026-11-20T00:00:00Z" }
  );
  assert.equal(
    bestAccess([
      { tier: "momentum", source: "package", until: "2026-11-20T00:00:00Z" },
      { tier: "momentum", source: "subscription", until: "2026-12-01T00:00:00Z" },
    ]).source,
    "subscription"
  );
});

test("what each membership opens; staff have everything", () => {
  assert.equal(hasPractice("clarity"), false);
  assert.equal(hasPractice("practice"), true);
  assert.equal(hasPractice("momentum"), true);
  assert.equal(hasMomentum("practice"), false);
  assert.equal(hasMomentum("clarity", "coach"), true);
  assert.equal(hasPractice("clarity", "admin"), true);
});

test("joining is open on previews, and on live only when switched on", () => {
  assert.equal(membershipsOpen({ production: false }), true);
  assert.equal(membershipsOpen({ production: true }), false);
  assert.equal(membershipsOpen({ open: "true", production: true }), true);
});

test("subscription states read plainly", () => {
  assert.equal(statusWords("active", false), "Active");
  assert.equal(statusWords("active", true), "Ends at the end of this month");
  assert.equal(statusWords("past_due", false), "Payment didn’t go through");
});
