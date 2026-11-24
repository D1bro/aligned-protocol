import { test } from "node:test";
import assert from "node:assert/strict";
import { areaNamed, copyProblem, DEFAULT_COPY, dueFollowup, followupEmail, FOLLOWUP_DAYS, pausedDaysSince, sequenceDays, type FollowupDay } from "../lib/followup-content.ts";
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
  // The sentence holding [score] is left out; nothing unfilled shows.
  assert.doesNotMatch(noScoreText, /You scored|\[score\]|\[first name\]/);
  assert.match(noScoreText, /^Hi,\n\nThank you for taking the Aligned Audit yesterday\.\n/);
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

test("Duane's saved wording is used instead of the original, with [first name] and [score] filled in", () => {
  const copy = { subject: "A note for [first name]", preheader: "", body: "Hi again.\n\nYou scored [score]. Well done, [first name].", button: "Go on then" };
  const m = followupEmail({ day: 3, hasStep: true, firstName: "Sam Fictional", score: 52, links, copy });
  assert.equal(m.subject, "A note for Sam");
  const t = renderText({ heading: m.heading, blocks: m.blocks });
  assert.match(t, /Hi again\.\n\nYou scored 52\. Well done, Sam\./);
  assert.match(t, /Go on then: https:\/\/x\.test\/next-step/); // the button still goes where it always does
  assert.equal(m.preheader, "");
});

test("an edit that can't go out is refused, and naming an area is flagged", () => {
  const ok = DEFAULT_COPY["1-new"];
  assert.equal(copyProblem(ok), null);
  assert.match(copyProblem({ ...ok, subject: " " }) ?? "", /subject/);
  assert.match(copyProblem({ ...ok, button: "" }) ?? "", /button/);
  assert.match(copyProblem({ ...ok, body: "Hello [area], how is it?" }) ?? "", /\[area\] isn’t something/);
  assert.match(copyProblem({ ...ok, body: Array(9).fill("A paragraph.").join("\n\n") }) ?? "", /Eight paragraphs/);
  for (const c of Object.values(DEFAULT_COPY)) {
    assert.equal(copyProblem(c), null);
    assert.equal(areaNamed(c), null); // the originals name no area
  }
  assert.equal(areaNamed({ ...ok, body: "How are things with Money & Stability?" }), "Money & Stability");
});

test("paused days don't count, so nobody loses their place", () => {
  // Audit on 23 Nov; paused 24–27 Nov (3 days): day 1 moves to 27 Nov.
  const pauses = [{ from: "2026-11-24", to: "2026-11-27" }];
  assert.equal(pausedDaysSince("2026-11-23", "2026-11-26", [{ from: "2026-11-24", to: null }]), 2);
  assert.equal(pausedDaysSince("2026-11-23", "2026-11-30", pauses), 3);
  assert.equal(pausedDaysSince("2026-11-28", "2026-11-30", pauses), 0); // started after the pause
  const d = (today: string) => dueFollowup({ ...base, today, pausedDays: pausedDaysSince(base.start, today, pauses) });
  assert.equal(d("2026-11-27"), 1);
  assert.equal(d("2026-11-29"), 3);
});

test("the console shows each person's four emails: sent, next, due, skipped or failed", () => {
  const states = sequenceDays({
    start: "2026-11-23",
    today: "2026-11-30",
    pausedDays: 0,
    sent: { 1: { status: "sent", date: "2026-11-24", reason: null }, 3: { status: "failed", date: "2026-11-26", reason: "resend 403" } },
    hasStep: false,
    checkinEmailOn: false,
  });
  assert.deepEqual(states.map((s) => s.state), ["sent", "failed", "next", "due"]);
  assert.equal(states[3].state === "due" && states[3].date, "2026-12-03");
  const covered = sequenceDays({ start: "2026-11-23", today: "2026-11-25", pausedDays: 0, sent: {}, hasStep: true, checkinEmailOn: true });
  assert.deepEqual(covered.map((s) => s.state), ["next", "due", "skipped", "due"]); // day 7: their check-in email covers it
  const late = sequenceDays({ start: "2026-11-23", today: "2026-11-27", pausedDays: 0, sent: {}, hasStep: false, checkinEmailOn: false });
  assert.deepEqual(late.map((s) => s.state), ["skipped", "next", "due", "due"]); // day 1 missed; day 3 goes next
});
