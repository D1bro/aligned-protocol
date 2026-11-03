import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, checkBirthDate, isMonthColour, lifeGrid, monthName, parseYm, yearRow } from "../lib/life-months.ts";

test("the grid is 1,000 months from the month of birth, a row per calendar year", () => {
  const rows = lifeGrid("1988-04", "2026-11");
  assert.equal(rows[0].year, 1988);
  const months = rows.flatMap((r) => r.months).filter((m) => m.state !== "before");
  assert.equal(months.length, 1000);
  assert.equal(months[0].ym, "1988-04");
  assert.deepEqual(rows[0].months.slice(0, 3).map((m) => m.state), ["before", "before", "before"]);
  assert.equal(months.filter((m) => m.state === "current").length, 1);
  assert.equal(months.find((m) => m.state === "current")!.ym, "2026-11");
  assert.ok(rows.every((r) => r.months.length === 12));
});

test("nothing in a cell is an age, a count or an end date", () => {
  const cell = lifeGrid("1988-04", "2026-11")[40].months[0];
  assert.deepEqual(Object.keys(cell).sort(), ["state", "ym"]);
});

test("a year row works with or without a date of birth", () => {
  assert.deepEqual(yearRow(2026, "2026-11").map((m) => m.state), [...Array(10).fill("past"), "current", "future"]);
  assert.equal(yearRow(1988, "2026-11", "1988-04")[2].state, "before");
});

test("months, colours and dates are checked", () => {
  assert.equal(parseYm("2026-11"), "2026-11");
  assert.equal(parseYm("2026-13"), null);
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(monthName("2026-11"), "November 2026");
  assert.ok(isMonthColour("restoring"));
  assert.ok(!isMonthColour("failing"));
  assert.deepEqual(checkBirthDate("", "2026-11-03"), { ok: true, value: null });
  assert.deepEqual(checkBirthDate("1988-04-17", "2026-11-03"), { ok: true, value: "1988-04-17" });
  assert.equal(checkBirthDate("1988-02-30", "2026-11-03").ok, false);
  assert.equal(checkBirthDate("2027-01-01", "2026-11-03").ok, false);
  assert.equal(checkBirthDate("17/04/1988", "2026-11-03").ok, false);
});
