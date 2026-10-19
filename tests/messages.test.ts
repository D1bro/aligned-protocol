import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMessage } from "../lib/messages.ts";

test("summary email links to the notes without including them", () => {
  const m = buildMessage({ kind: "summary_shared", firstName: "Sam", sessionLabel: "Tue, 27 Oct 2026", coachName: "Test Coach", link: "https://x.test/coaching/sessions/1" });
  assert.equal(m.subject, "Your session notes are ready");
  assert.match(m.text, /Tue, 27 Oct 2026/);
  assert.match(m.text, /https:\/\/x\.test\/coaching\/sessions\/1/);
  assert.match(m.html, /href="https:\/\/x\.test\/coaching\/sessions\/1"/);
});

test("personal notes are escaped in HTML and kept as written in text", () => {
  const m = buildMessage({ kind: "summary_shared", firstName: "Sam", sessionLabel: "today", coachName: "C", link: "https://x.test", note: "<script>alert(1)</script> & see you soon" });
  assert.ok(!m.html.includes("<script>"));
  assert.match(m.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; see you soon/);
  assert.match(m.text, /<script>alert\(1\)<\/script> & see you soon/);
});

test("session emails say what changed", () => {
  const base = { kind: "session_update" as const, firstName: "Sam", coachName: "C", when: "Tue, 27 Oct 2026, 19:30 GMT", durationMinutes: 60, location: "Zoom", link: "https://x.test" };
  assert.equal(buildMessage({ ...base, change: "confirmed" }).subject, "Your coaching session is confirmed");
  const moved = buildMessage({ ...base, change: "rescheduled", previousWhen: "Mon, 26 Oct 2026, 18:00 GMT" });
  assert.match(moved.text, /Mon, 26 Oct 2026, 18:00 GMT has moved to:\n\nTue, 27 Oct 2026, 19:30 GMT/);
  assert.match(moved.text, /Where: Zoom/);
  assert.match(buildMessage({ ...base, change: "cancelled" }).text, /is cancelled/);
});

test("invoice email gives the amount, due date and bank reference", () => {
  const m = buildMessage({
    kind: "invoice_issued", firstName: "Sam", supplierName: "Aligned Media", number: "AM-0004", total: "£160.00", owed: "£160.00", partPaid: false, due: "29 October 2026",
    bank: { accountName: "A", sortCode: "00-00-00", accountNumber: "00000000" }, cardPayments: false, link: "https://x.test/coaching",
  });
  assert.equal(m.subject, "Invoice AM-0004 from Aligned Media");
  assert.match(m.text, /£160\.00 is ready, due by 29 October 2026/);
  assert.match(m.text, /Reference: AM-0004/);
  assert.ok(!/card/.test(m.text));
});

test("invoice email leaves out bank details that aren't complete", () => {
  const m = buildMessage({ kind: "invoice_issued", firstName: "Sam", supplierName: "Aligned Media", number: "AM-1", total: "£1.00", owed: "£1.00", partPaid: false, due: "1 Nov", bank: { accountName: "A" }, cardPayments: true, link: "https://x.test" });
  assert.ok(!/Sort code/.test(m.text));
  assert.match(m.text, /pay by card/);
});

test("payment receipt lists where the money went, and any left over", () => {
  const m = buildMessage({
    kind: "payment_received", firstName: "Sam", supplierName: "Aligned Media", amount: "£160.00", receivedOn: "15 October 2026",
    applied: [{ number: "AM-0002", amount: "£30.00" }], unapplied: "£130.00", link: "https://x.test",
  });
  assert.match(m.text, /£30\.00 paid towards invoice AM-0002/);
  assert.match(m.text, /£130\.00 hasn’t been put towards an invoice yet/);
});

test("invoice email for a paid or part-paid invoice doesn't ask for the full amount", () => {
  const base = { kind: "invoice_issued" as const, firstName: "Sam", supplierName: "Aligned Media", number: "AM-5", total: "£80.00", due: "10 October 2026", bank: { accountName: "A", sortCode: "00-00-00", accountNumber: "00000000" }, cardPayments: true, link: "https://x.test" };
  const paid = buildMessage({ ...base, owed: null, partPaid: false });
  assert.match(paid.text, /paid in full/);
  assert.ok(!/Sort code|pay by card/.test(paid.text));
  const part = buildMessage({ ...base, owed: "£30.00", partPaid: true });
  assert.match(part.text, /£30\.00 still to pay/);
  assert.match(part.text, /Reference: AM-5/);
});

test("payment receipt mentions any refund", () => {
  const m = buildMessage({
    kind: "payment_received", firstName: "Sam", supplierName: "Aligned Media", amount: "£160.00", receivedOn: "15 October 2026",
    applied: [{ number: "AM-0002", amount: "£30.00" }], refunded: [{ amount: "£130.00", on: "15 October 2026" }], unapplied: null, link: "https://x.test",
  });
  assert.match(m.text, /£130\.00 refunded to you on 15 October 2026/);
  assert.ok(!/hasn’t been put towards/.test(m.text));
});
