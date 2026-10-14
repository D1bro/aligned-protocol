import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripeEvent } from "../lib/stripe-signature.ts";

const secret = "whsec_unit_test_only";
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
const sign = (t: number, b = body, s = secret) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${b}`).digest("hex")}`;

test("a correctly signed, recent event is accepted", () => {
  assert.equal(verifyStripeEvent(body, sign(1000), secret, 1000)?.id, "evt_1");
  assert.equal(verifyStripeEvent(body, `${sign(1000)},v1=deadbeef`, secret, 1100)?.id, "evt_1");
});

test("forged, altered, stale or unsigned events are refused", () => {
  assert.equal(verifyStripeEvent(body, sign(1000, body, "whsec_other"), secret, 1000), null);
  assert.equal(verifyStripeEvent(body.replace("evt_1", "evt_2"), sign(1000), secret, 1000), null);
  assert.equal(verifyStripeEvent(body, sign(1000), secret, 1000 + 301), null);
  assert.equal(verifyStripeEvent(body, null, secret, 1000), null);
  assert.equal(verifyStripeEvent(body, sign(1000), "", 1000), null);
  assert.equal(verifyStripeEvent(body, "t=1000", secret, 1000), null);
});
