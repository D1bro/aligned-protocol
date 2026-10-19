import { test } from "node:test";
import assert from "node:assert/strict";
import { guestState, idleGuests, isProtected, latest, type GuestRow } from "../lib/guests.ts";

const NOW = new Date("2026-10-19T12:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function guest(over: Partial<GuestRow>): GuestRow {
  return { id: "g", createdAt: daysAgo(100), lastActiveAt: daysAgo(100), answered: 0, finished: false, score: null, enquiry: false, billing: false, ...over };
}

test("a guest's state comes from their answers", () => {
  assert.equal(guestState({ answered: 0, finished: false }), "empty");
  assert.equal(guestState({ answered: 4, finished: false }), "started");
  assert.equal(guestState({ answered: 10, finished: true }), "finished");
});

test("guests with an enquiry or billing record are protected", () => {
  assert.equal(isProtected(guest({})), false);
  assert.equal(isProtected(guest({ enquiry: true })), true);
  assert.equal(isProtected(guest({ billing: true })), true);
});

test("bulk clean-up takes only unfinished, unprotected guests idle long enough", () => {
  const list = [
    guest({ id: "empty-old" }),
    guest({ id: "started-old", answered: 3 }),
    guest({ id: "finished-old", answered: 10, finished: true, score: 70 }),
    guest({ id: "enquiry-old", answered: 2, enquiry: true }),
    guest({ id: "billing-old", billing: true }),
    guest({ id: "started-recent", answered: 5, lastActiveAt: daysAgo(3) }),
    guest({ id: "exactly-30", lastActiveAt: daysAgo(30) }),
  ];
  assert.deepEqual(idleGuests(list, 30, NOW).map((g) => g.id), ["empty-old", "started-old", "exactly-30"]);
  assert.deepEqual(idleGuests(list, 2, NOW).map((g) => g.id), ["empty-old", "started-old", "started-recent", "exactly-30"]);
});

test("a nonsense idle period removes nobody", () => {
  const list = [guest({})];
  assert.deepEqual(idleGuests(list, 0, NOW), []);
  assert.deepEqual(idleGuests(list, Number.NaN, NOW), []);
  assert.deepEqual(idleGuests(list, -5, NOW), []);
});

test("latest picks the newest date and ignores gaps", () => {
  assert.equal(latest(null, daysAgo(5), undefined, daysAgo(1), daysAgo(9)), daysAgo(1));
  assert.equal(latest(null, undefined), null);
});
