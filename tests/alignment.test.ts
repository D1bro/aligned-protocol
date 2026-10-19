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

import { summariseWeek, describeCounts, isFutureDay, isFutureWeek } from "../lib/alignment.ts";

test("weekly counts keep answers, blanks, unrecorded and upcoming days apart, with no overall score", () => {
  // Week of Mon 19 Oct 2026; "today" is Thursday 22nd.
  const days = [
    { entry_date: "2026-10-19", wellbeing: "yes" as const, values_choice: "not_needed" as const },
    { entry_date: "2026-10-20", wellbeing: "partly" as const, values_choice: "yes" as const },
    { entry_date: "2026-10-21", wellbeing: null, values_choice: null },
  ];
  const w = summariseWeek(days, "2026-10-21", "2026-10-22");
  assert.deepEqual(w.wellbeing, { yes: 1, partly: 1, not_today: 0, not_needed: 0, answered: 2, blank: 1, unrecorded: 1, upcoming: 3 });
  assert.equal(w.values_choice.not_needed, 1, "No challenge arose counted separately");
  assert.equal(w.values_choice.answered, 1, "and excluded from the answered total");
  assert.equal(w.meaningful_action.blank, 3, "saved entries with this question blank");
  assert.deepEqual(describeCounts(w.wellbeing), { answers: "Yes 1 · Partly 1 · Not today 0", days: "2 answered days · 1 saved but left blank · 1 unrecorded day · 3 still to come" });
});

test("a week with nothing saved is fine, and a finished week has nothing still to come", () => {
  const w = summariseWeek([], "2026-10-12", "2026-10-22");
  assert.deepEqual(w.participation, { yes: 0, partly: 0, not_today: 0, not_needed: 0, answered: 0, blank: 0, unrecorded: 7, upcoming: 0 });
  assert.deepEqual(describeCounts(w.participation), { answers: "No answers saved", days: "0 answered days · 7 unrecorded days" });
});

test("the week of the October 2026 clock change still has seven distinct days", () => {
  const w = summariseWeek([{ entry_date: "2026-10-25", wellbeing: "not_today" as const }], "2026-10-25", "2026-11-01");
  assert.equal(w.wellbeing.not_today + w.wellbeing.unrecorded, 7);
});

test("future days and weeks are judged in the member's own time zone", () => {
  const now = new Date("2026-10-19T22:30:00Z"); // 23:30 on the 19th in London (BST), 00:30 on the 20th in Paris (CEST)
  assert.equal(isFutureDay("2026-10-20", "Europe/London", now), true);
  assert.equal(isFutureDay("2026-10-20", "Europe/Paris", now), false);
  assert.equal(isFutureWeek("2026-10-26", "Europe/London", now), true);
  assert.equal(isFutureWeek("2026-10-19", "Europe/London", now), false);
});
