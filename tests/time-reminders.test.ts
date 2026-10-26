import { test } from "node:test";
import assert from "node:assert/strict";
import { isTomorrow, sessionDayTime, sessionRef } from "../lib/time.ts";

const now = new Date("2026-10-26T20:00:00Z"); // Monday evening, UK

test("'tomorrow' is the next calendar day in the session's time zone", () => {
  assert.equal(isTomorrow("2026-10-27T09:00:00Z", "Europe/London", now), true);
  assert.equal(isTomorrow("2026-10-27T23:30:00Z", "Europe/London", now), true);
  assert.equal(isTomorrow("2026-10-26T23:30:00Z", "Europe/London", now), false);
  assert.equal(isTomorrow("2026-10-28T00:30:00Z", "Europe/London", now), false);
  // Already Tuesday in Sydney, so Wednesday there is "tomorrow".
  assert.equal(isTomorrow("2026-10-27T22:00:00Z", "Australia/Sydney", now), true);
});

test("emails name a recent session by weekday and an older one by date", () => {
  assert.equal(sessionRef("2026-10-26T10:00:00Z", "Europe/London", now), "Monday");
  assert.equal(sessionRef("2026-10-21T10:00:00Z", "Europe/London", now), "Wednesday");
  assert.equal(sessionRef("2026-10-12T10:00:00Z", "Europe/London", now), "12 October");
  assert.equal(sessionDayTime("2026-11-09T10:00:00Z", "Europe/London"), "Monday 9 November at 10:00");
  assert.equal(sessionDayTime("2026-07-06T09:00:00Z", "Europe/London"), "Monday 6 July at 10:00");
});
