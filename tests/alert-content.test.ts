import { test } from "node:test";
import assert from "node:assert/strict";
import { auditAlert, enquiryAlert, signupAlert, testAlert } from "../lib/alert-content.ts";
import { renderText } from "../lib/email-layout.ts";

const text = (m: { heading: string; blocks: Parameters<typeof renderText>[0]["blocks"] }) => renderText(m);

test("a sign-up after a guest audit shows who, how and where they've got to", () => {
  const m = signupAlert({
    name: "Sam Fictional",
    email: "sam.fictional@example.com",
    route: "saved-plan",
    progress: { score: 45, auditNumber: 1, area: "Relationships & Connection", step: "Have the conversation" },
    recordUrl: "https://example.test/coach/clients/abc",
  });
  assert.equal(m.subject, "New sign-up: Sam Fictional");
  const t = text(m);
  assert.match(t, /sam\.fictional@example\.com/);
  assert.match(t, /saved their plan/);
  assert.match(t, /Audit 1: 45\/100/);
  assert.match(t, /Starting with: Relationships & Connection/);
  assert.match(t, /Next Step: Have the conversation/);
  assert.match(t, /https:\/\/example\.test\/coach\/clients\/abc/);
});

test("a sign-up with no audit yet says so, and falls back to the email for a name", () => {
  const m = signupAlert({ name: " ", email: "new@example.com", route: "direct", progress: null, recordUrl: "x" });
  assert.equal(m.subject, "New sign-up: new@example.com");
  assert.match(text(m), /No audit finished yet/);
});

test("a finished audit shows the change since the last one", () => {
  const m = auditAlert({ name: "Sam", email: "s@example.com", score: 52, auditNumber: 2, previousScore: 45, recordUrl: "x" });
  assert.equal(m.subject, "Sam finished audit 2: 52/100");
  assert.match(text(m), /\+7 since their last/);
  const first = auditAlert({ name: "Sam", email: null, score: 40, auditNumber: 1, previousScore: null, recordUrl: "x" });
  assert.match(text(first), /first Aligned Audit, scoring 40\/100\./);
});

test("an enquiry carries the person's own words, and skips what they left blank", () => {
  const m = enquiryAlert({
    name: "Sam",
    email: "s@example.com",
    wantsHelp: "Finding direction at work",
    tried: null,
    availability: "Weekday evenings",
    enquiriesUrl: "https://example.test/coach/enquiries",
  });
  assert.equal(m.subject, "New coaching enquiry from Sam");
  const t = text(m);
  assert.match(t, /Finding direction at work/);
  assert.match(t, /Weekday evenings/);
  assert.doesNotMatch(t, /tried so far/);
  assert.match(t, /Reply to this email/);
});

test("the test alert links back to Site health", () => {
  assert.match(text(testAlert("https://example.test")), /https:\/\/example\.test\/coach\/health/);
});
