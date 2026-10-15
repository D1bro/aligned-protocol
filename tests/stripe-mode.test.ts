import { test } from "node:test";
import assert from "node:assert/strict";
import { stripeMode, eventMatchesMode } from "../lib/stripe-mode.ts";

const T = "sk_test_" + "a".repeat(24), L = "sk_live_" + "b".repeat(24);

test("no key: off", () => assert.equal(stripeMode("", { allowLive: true, production: true }).ready, false));

test("test keys work on the Mac and previews, never on the live site", () => {
  assert.deepEqual(stripeMode(T, { allowLive: false, production: false }), { ready: true, live: false });
  assert.match((stripeMode(T, { allowLive: true, production: true }) as { reason: string }).reason, /aren’t used on the live site/);
});

test("live keys need the deliberate switch", () => {
  assert.match((stripeMode(L, { allowLive: false, production: true }) as { reason: string }).reason, /STRIPE_ALLOW_LIVE/);
  assert.deepEqual(stripeMode(L, { allowLive: true, production: true }), { ready: true, live: true });
});

test("anything else isn't a key", () => {
  assert.equal(stripeMode("pk_live_xxx", { allowLive: true, production: true }).ready, false);
  assert.equal(stripeMode("whsec_xxx", { allowLive: true, production: false }).ready, false);
});

test("events only count in the matching mode", () => {
  const live = stripeMode(L, { allowLive: true, production: true });
  const testMode = stripeMode(T, { allowLive: false, production: false });
  assert.equal(eventMatchesMode(true, live), true);
  assert.equal(eventMatchesMode(false, live), false);
  assert.equal(eventMatchesMode(false, testMode), true);
  assert.equal(eventMatchesMode(true, testMode), false);
  assert.equal(eventMatchesMode(undefined, testMode), true);
  assert.equal(eventMatchesMode(true, stripeMode("", { allowLive: true, production: true })), false);
});
