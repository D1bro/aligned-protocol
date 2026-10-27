import { test } from "node:test";
import assert from "node:assert/strict";
import { firstActionDate, longDay, nextReview, plannedDays, upcomingReviews } from "../lib/review-schedule.ts";

const sunday = "Every Sunday at 6pm, after dinner";
const start = "2026-10-27T10:00:00Z"; // Tuesday

test("planned days come from the action's wording", () => {
  assert.deepEqual(plannedDays(sunday), [6]);
  assert.deepEqual(plannedDays("Every Monday and Thursday at 7am"), [0, 3]);
  assert.deepEqual(plannedDays("Every day at 8pm"), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(plannedDays("A few times a week"), []);
});

test("the first review is the day after the week's last planned action", () => {
  const r = nextReview({ start, actionWhen: sunday, reviews: [] }, new Date("2026-10-28T12:00:00Z"));
  assert.equal(r.date, "2026-11-02");
  assert.equal(longDay(r.date), "Monday 2 November");
  assert.equal(r.kind, "weekly");
  assert.equal(r.due, false);
  assert.equal(r.daysAway, 5);
  assert.equal(firstActionDate(start, sunday), "2026-11-01");
  // Twice a week: the review follows the later day.
  assert.equal(nextReview({ start, actionWhen: "Every Monday and Thursday", reviews: [] }).date, "2026-10-30");
});

test("reviews come weekly, and the fourth is the monthly review", () => {
  const reviews = [{ created_at: "2026-11-02T09:00:00Z" }, { created_at: "2026-11-09T09:00:00Z" }, { created_at: "2026-11-16T20:00:00Z" }];
  const r = nextReview({ start, actionWhen: sunday, reviews }, new Date("2026-11-23T08:00:00Z"));
  assert.equal(r.date, "2026-11-23");
  assert.equal(r.kind, "monthly");
  assert.equal(r.number, 4);
  assert.equal(r.due, true);
  assert.deepEqual(
    upcomingReviews(start, sunday).map((x) => `${x.date} ${x.kind}`),
    ["2026-11-02 weekly", "2026-11-09 weekly", "2026-11-16 weekly", "2026-11-23 monthly"]
  );
});

test("an early or late review doesn't bunch the next one up", () => {
  // Reviewed on Saturday, a day early: the next is the Monday after next.
  assert.equal(nextReview({ start, actionWhen: sunday, reviews: [{ created_at: "2026-10-31T10:00:00Z" }] }).date, "2026-11-09");
  // Reviewed on Wednesday, two days late: the next Monday is still five days on.
  assert.equal(nextReview({ start, actionWhen: sunday, reviews: [{ created_at: "2026-11-04T10:00:00Z" }] }).date, "2026-11-09");
  // No days chosen: a week after the last one.
  assert.equal(nextReview({ start, actionWhen: "Weekly", reviews: [] }).date, "2026-11-03");
});
