import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPence, parsePounds, penceToInput } from "../lib/money.ts";
import { trackerStatus, draftTotals, looksLikeDuplicate, todayUk } from "../lib/billing-status.ts";

test("pence format as pounds", () => {
  assert.equal(formatPence(0), "£0.00");
  assert.equal(formatPence(5), "£0.05");
  assert.equal(formatPence(7500), "£75.00");
  assert.equal(formatPence(123456), "£1,234.56");
  assert.equal(formatPence(-500), "−£5.00");
});

test("pounds parse to whole pence without floating-point error", () => {
  assert.equal(parsePounds("75"), 7500);
  assert.equal(parsePounds("£1,234.5"), 123450);
  assert.equal(parsePounds("0.29"), 29); // 0.29 * 100 = 28.999… in floats
  assert.equal(parsePounds("19.99"), 1999);
  assert.equal(parsePounds(" £ 10.00 "), 1000);
});

test("bad amounts are refused", () => {
  for (const bad of ["", "abc", "-5", "1.234", "1e3", "£", "12.", "10,00.00.0"]) assert.equal(parsePounds(bad), null, bad);
});

test("editable value round-trips", () => {
  for (const p of [0, 5, 7500, 123456]) assert.equal(parsePounds(penceToInput(p)), p);
});

test("draft totals: lines times quantity, less discount", () => {
  assert.deepEqual(draftTotals([{ quantity: 3, unit_pence: 7500 }, { quantity: 1, unit_pence: 1999 }], 2000), { subtotal: 24499, total: 22499 });
  assert.deepEqual(draftTotals([], 0), { subtotal: 0, total: 0 });
});

test("tracker status", () => {
  const base = { status: "issued", due_date: "2026-10-20", paid_pence: 0, balance_pence: 22500 };
  assert.equal(trackerStatus({ ...base, status: "draft" }, "2026-10-15"), "draft");
  assert.equal(trackerStatus({ ...base, status: "void" }, "2026-10-15"), "void");
  assert.equal(trackerStatus(base, "2026-10-15"), "unpaid");
  assert.equal(trackerStatus(base, "2026-10-20"), "unpaid"); // due today isn't overdue
  assert.equal(trackerStatus(base, "2026-10-21"), "overdue");
  assert.equal(trackerStatus({ ...base, paid_pence: 10000, balance_pence: 12500 }, "2026-10-15"), "part_paid");
  assert.equal(trackerStatus({ ...base, paid_pence: 10000, balance_pence: 12500 }, "2026-11-01"), "overdue");
  assert.equal(trackerStatus({ ...base, paid_pence: 22500, balance_pence: 0 }, "2026-11-01"), "paid");
  // Settled by a credit note with nothing paid still counts as nothing owed.
  assert.equal(trackerStatus({ ...base, paid_pence: 0, balance_pence: 0 }, "2026-11-01"), "paid");
});

test("UK date crosses midnight on UK time, not UTC", () => {
  // 23:30 UTC on 15 July is 00:30 BST on 16 July.
  assert.equal(todayUk(new Date("2026-07-15T23:30:00Z")), "2026-07-16");
  // 23:30 UTC on 15 December is still 15 December in GMT.
  assert.equal(todayUk(new Date("2026-12-15T23:30:00Z")), "2026-12-15");
});

test("duplicate bank transfer detection", () => {
  const a = { amount_pence: 22500, received_on: "2026-10-10", reference: "AM-0001" };
  assert.equal(looksLikeDuplicate(a, { ...a }), true);
  assert.equal(looksLikeDuplicate(a, { ...a, received_on: "2026-10-12" }), true);
  assert.equal(looksLikeDuplicate(a, { ...a, received_on: "2026-10-20" }), false);
  assert.equal(looksLikeDuplicate(a, { ...a, amount_pence: 22501 }), false);
  assert.equal(looksLikeDuplicate(a, { ...a, reference: "AM-0002" }), false);
  assert.equal(looksLikeDuplicate(a, { ...a, reference: null }), true);
});
