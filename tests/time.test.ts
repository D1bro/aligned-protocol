import { test } from "node:test";
import assert from "node:assert/strict";
import { localToUtc, toLocalParts, formatSessionTime } from "../lib/time.ts";

test("winter time is GMT (UTC+0)", () => {
  assert.equal(localToUtc("2026-12-01", "18:00")?.toISOString(), "2026-12-01T18:00:00.000Z");
});

test("summer time is BST (UTC+1)", () => {
  assert.equal(localToUtc("2026-07-01", "18:00")?.toISOString(), "2026-07-01T17:00:00.000Z");
});

test("either side of the clocks going back (25 Oct 2026)", () => {
  assert.equal(localToUtc("2026-10-24", "09:00")?.toISOString(), "2026-10-24T08:00:00.000Z");
  assert.equal(localToUtc("2026-10-26", "09:00")?.toISOString(), "2026-10-26T09:00:00.000Z");
});

test("the skipped hour when clocks go forward doesn't exist", () => {
  assert.equal(localToUtc("2027-03-28", "01:30"), null);
});

test("round trip and labels", () => {
  const u = localToUtc("2026-11-03", "18:00")!;
  assert.deepEqual(toLocalParts(u), { date: "2026-11-03", time: "18:00" });
  assert.match(formatSessionTime(u), /18:00 GMT$/);
  assert.match(formatSessionTime(localToUtc("2026-07-01", "18:00")!), /18:00 BST$/);
});

test("rejects malformed input", () => {
  assert.equal(localToUtc("2026-13-01", "18:00"), null);
  assert.equal(localToUtc("01/12/2026", "18:00"), null);
  assert.equal(localToUtc("2026-12-01", "25:00"), null);
});
