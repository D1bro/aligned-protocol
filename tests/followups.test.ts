import { test } from "node:test";
import assert from "node:assert/strict";
import { dueFollowup, followupEmail, FOLLOWUP_DAYS, type FollowupDay } from "../lib/followup-content.ts";
import { renderText } from "../lib/email-layout.ts";
import { signupAlert } from "../lib/alert-content.ts";

const base = { start: "2026-11-23", sent: [] as number[], hasStep: false, checkinEmailOn: false };
const due = (today: string, over: Partial<typeof base> = {}) => dueFollowup({ ...base, ...over, today });

test("each email goes on its own day, and nothing on the days between", () => {
  assert.equal(due("2026-11-23"), null); // the audit day itself
  assert.equal(due("2026-11-24"), 1);
  assert.equal(due("2026-11-26"), 3);
  assert.equal(due("2026-11-30"), 7);
  assert.equal(due("2026-12-03"), 10);
  // Already sent: nothing more that day, or the next.
  assert.equal(due("2026-11-24", { sent: [1] }), null);
  assert.equal(due("2026-11-25", { sent: [1] }), null);
});

test("a missed morning is caught up within two days, then skipped", () => {
  assert.equal(due("2026-11-25"), 1); // a day late: still goes
  assert.equal(due("2026-11-28", { sent: [1] }), 3); // two days late
  assert.equal(due("2026-12-02", { sent: [1, 3] }), 7);
  assert.equal(due("2026-12-06", { sent: [1, 3, 7] }), null); // day 10 three days late: dropped
  assert.equal(due("2027-01-15", { sent: [] }), null); // long after: the sequence is over
});

test("day 7 isn't sent when their weekly check-in email already asks the same", () => {
  assert.equal(due("2026-11-30", { hasStep: true, checkinEmailOn: true }), null);
  assert.equal(due("2026-11-30", { hasStep: true, checkinEmailOn: false }), 7);
  assert.equal(due("2026-11-30", { hasStep: false, checkinEmailOn: true }), 7);
});

const links = { nextStep: "https://x.test/next-step", checkIn: "https://x.test/check-in", coaching: "https://x.test/coaching", stop: "https://x.test/stop" };
const all = FOLLOWUP_DAYS.flatMap((day) => [false, true].map((hasStep) => ({ day: day as FollowupDay, hasStep })));

test("all eight emails are personal, signed by Duane and can be stopped", () => {
  for (const { day, hasStep } of all) {
    const m = followupEmail({ day, hasStep, firstName: "Sam Fictional", score: 45, links });
    const t = renderText({ heading: m.heading, blocks: m.blocks, signature: m.signature });
    assert.equal(m.heading, "Hi Sam,");
    assert.match(t, /\nDuane\n/);
    assert.match(t, /Stop these emails: https:\/\/x\.test\/stop/);
    assert.ok(m.subject.length > 0 && m.subject.length < 60);
  }
  const subjects = new Set(all.filter((x) => x.day !== 10).map(({ day, hasStep }) => followupEmail({ day, hasStep, firstName: null, score: null, links }).subject));
  assert.equal(subjects.size, 6);
});

test("the emails never carry the area or the words of someone's Next Step", () => {
  // Nothing personal goes in except a first name and the overall score: the
  // builder isn't even given the area or the step.
  for (const { day, hasStep } of all) {
    const m = followupEmail({ day, hasStep, firstName: "Sam", score: 45, links });
    const t = renderText({ heading: m.heading, blocks: m.blocks, signature: m.signature });
    assert.doesNotMatch(t, /Relationships|Finances|Health|Career/);
  }
  const first = followupEmail({ day: 1, hasStep: false, firstName: "Sam", score: 45, links });
  assert.match(renderText({ heading: first.heading, blocks: first.blocks }), /You scored 45\/100\./);
  const noScore = followupEmail({ day: 1, hasStep: false, firstName: null, score: null, links });
  assert.equal(noScore.heading, "Hi,");
  const noScoreText = renderText({ heading: noScore.heading, blocks: noScore.blocks });
  assert.doesNotMatch(noScoreText, /You scored|a number like that/);
  assert.match(noScoreText, /scores like these can sting/);
});

test("the right buttons: set the step, open it, check in, or see coaching", () => {
  const button = (day: FollowupDay, hasStep: boolean) => {
    const b = followupEmail({ day, hasStep, firstName: "Sam", score: 45, links }).blocks.find((x) => "button" in x);
    return b && "button" in b ? b.button : null;
  };
  assert.equal(button(1, false)?.href, links.nextStep);
  assert.equal(button(3, true)?.label, "Open my Next Step");
  assert.equal(button(7, true)?.href, links.checkIn);
  assert.equal(button(10, false)?.href, links.coaching);
  assert.equal(button(10, true)?.href, links.coaching);
});

test("the sign-up alert says whether they asked for follow-ups", () => {
  const args = { name: "Sam", email: "s@example.com", route: "direct" as const, progress: null, recordUrl: "x" };
  const t = (followups?: boolean) => { const m = signupAlert({ ...args, followups }); return renderText(m); };
  assert.match(t(true), /asked for your follow-up emails/);
  assert.match(t(false), /didn’t ask for follow-up emails/);
  assert.doesNotMatch(t(undefined), /follow-up/);
});
