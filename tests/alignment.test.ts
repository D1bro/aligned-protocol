import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays, checkDailyAlignment, checkWeeklyAlignment, isAlignmentDate,
  isAlignmentSchemaMissing, localDate, normalizeTimeZone, weekDates, weekStart,
} from "../lib/alignment.ts";

test("local calendar date follows the selected IANA zone with UTC fallback", () => {
  const instant = new Date("2026-10-19T00:30:00Z");
  assert.equal(localDate("Europe/London", instant), "2026-10-19");
  assert.equal(localDate("America/Los_Angeles", instant), "2026-10-18");
  assert.equal(localDate("Pacific/Auckland", instant), "2026-10-19");
  assert.equal(normalizeTimeZone("Invalid/Place"), "UTC");
  assert.equal(normalizeTimeZone(undefined), "UTC");
  assert.equal(localDate("Invalid/Place", instant), "2026-10-19");
});

test("Monday grouping uses calendar arithmetic through both UK DST changes", () => {
  for (const [date, monday, sunday] of [["2026-03-29", "2026-03-23", "2026-03-29"], ["2026-10-25", "2026-10-19", "2026-10-25"]]) {
    assert.equal(weekStart(date), monday);
    const dates = weekDates(date);
    assert.equal(dates.length, 7);
    assert.equal(new Set(dates).size, 7);
    assert.equal(dates[0], monday);
    assert.equal(dates[6], sunday);
    assert.equal(weekStart(addCalendarDays(sunday, 1)), addCalendarDays(monday, 7));
  }
  assert.equal(weekStart("2027-01-01"), "2026-12-28");
});

test("invalid dates and non-Monday weekly keys are rejected", () => {
  for (const date of ["2026-02-29", "2026-13-01", "26-01-01", "2026-1-01", "2026-04-31", "0000-01-01"]) assert.equal(isAlignmentDate(date), false, date);
  assert.equal(isAlignmentDate("2028-02-29"), true);
  assert.throws(() => weekStart("2026-02-29"));
  assert.equal(checkWeeklyAlignment({ week_start: "2026-10-20", timezone: "UTC" }).ok, false);
});

test("an explicit save may omit every optional response without inventing scores", () => {
  const checked = checkDailyAlignment({ entry_date: "2026-10-19", timezone: "Europe/London" });
  assert.ok(checked.ok);
  assert.equal(checked.values.wellbeing, null);
  assert.equal(checked.values.meaningful_action, null);
  assert.equal(checked.values.participation, null);
  assert.equal(checked.values.values_choice, null);
  assert.equal(checked.values.presence_done, null);
  assert.equal(checked.values.priority, null);
  const absentZone = checkDailyAlignment({ entry_date: "2026-10-19" });
  assert.ok(absentZone.ok);
  assert.equal(absentZone.values.timezone, "UTC");
});

test("enums, booleans, text and goal IDs are checked without coercion", () => {
  const base = { entry_date: "2026-10-19", timezone: "Europe/London" };
  for (const field of ["wellbeing", "meaningful_action", "participation"]) {
    assert.equal(checkDailyAlignment({ ...base, [field]: "not_needed" }).ok, false, field);
  }
  assert.equal(checkDailyAlignment({ ...base, values_choice: "not_needed" }).ok, true);
  assert.equal(checkDailyAlignment({ ...base, wellbeing: 1 }).ok, false);
  assert.equal(checkDailyAlignment({ ...base, presence_done: "yes" }).ok, false);
  assert.equal(checkDailyAlignment({ ...base, priority: 1 }).ok, false);
  assert.equal(checkDailyAlignment({ ...base, goal_id: "someone-else" }).ok, false);
  assert.equal(checkDailyAlignment({ ...base, timezone: "GMT+1" }).ok, false);
  assert.equal(checkDailyAlignment({ ...base, presence_done: false }).ok, true);
});

test("length caps match database characters and preserve intentional note lines", () => {
  const base = { entry_date: "2026-10-19", timezone: "UTC" };
  for (const [field, limit] of Object.entries({ priority: 500, value: 80, wellbeing_action: 300, evening_note: 1000 })) {
    assert.equal(checkDailyAlignment({ ...base, [field]: "x".repeat(limit) }).ok, true, field);
    assert.equal(checkDailyAlignment({ ...base, [field]: "x".repeat(limit + 1) }).ok, false, field);
  }
  assert.equal(checkDailyAlignment({ ...base, value: "💛".repeat(80) }).ok, true);
  const checked = checkDailyAlignment({ ...base, evening_note: "  First\r\nSecond  ", value: "  " });
  assert.ok(checked.ok);
  assert.equal(checked.values.evening_note, "First\nSecond");
  assert.equal(checked.values.value, null);
  for (const field of ["helped", "adjustment", "next_priority"]) {
    assert.equal(checkWeeklyAlignment({ week_start: "2026-10-19", timezone: "UTC", [field]: "x".repeat(1001) }).ok, false);
  }
});

test("missing migration is distinct from empty records or network/permission failures", () => {
  assert.equal(isAlignmentSchemaMissing({ code: "42P01" }), true);
  assert.equal(isAlignmentSchemaMissing({ code: "PGRST205" }), true);
  assert.equal(isAlignmentSchemaMissing(null), false);
  assert.equal(isAlignmentSchemaMissing({ code: "42501" }), false);
  assert.equal(isAlignmentSchemaMissing({ code: "PGRST000" }), false);
});
