// The follow-up emails after the audit (Duane, 24 Nov 2026): what each one
// says, and which one is due. Kept free of server-only imports so both can
// be tested directly (tests/followups.test.ts). The words are Duane's (the
// doc "After the audit: follow-up emails"); change them here.
//
// Privacy: these never name the area someone chose, their scores by area or
// the words of their Next Step. Inboxes get shared and previewed on lock
// screens. Their first name and overall score only.
import type { Block, Signature } from "./email-layout.ts";

export const FOLLOWUP_DAYS = [1, 3, 7, 10] as const;
export type FollowupDay = (typeof FOLLOWUP_DAYS)[number];

// Sent at 9:21am UK time (Duane's choice). The job runs at 08:21 and 09:21
// UTC and only sends on the run that is 9am in London, so it's right in
// both GMT and BST.
export const SEND_HOUR_LONDON = 9;

// An email that's this many days late is skipped rather than sent late
// (the job missed a morning, say); the next one goes on its own day.
const GRACE_DAYS = 2;

// Whole calendar days from one YYYY-MM-DD date to another.
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// Which follow-up (if any) goes today. `start` is the London date day 0
// counts from: the later of their first finished audit and the day they
// asked for these emails.
export function dueFollowup(input: {
  start: string;
  today: string;
  sent: number[];
  hasStep: boolean;
  checkinEmailOn: boolean;
}): FollowupDay | null {
  const days = daysBetween(input.start, input.today);
  const day = [...FOLLOWUP_DAYS].reverse().find((d) => d <= days);
  if (!day || days - day > GRACE_DAYS || input.sent.includes(day)) return null;
  // Day 7 asks "is it closer?", which their weekly check-in email already
  // does: don't send both.
  if (day === 7 && input.hasStep && input.checkinEmailOn) return null;
  return day;
}

export type FollowupEmail = {
  subject: string;
  preheader: string;
  heading: string;
  blocks: Block[];
  signature: Signature;
};

export const DUANE: Signature = { name: "Duane Bryan", role: "Coach, Aligned" };

export function followupEmail(input: {
  day: FollowupDay;
  firstName: string | null;
  score: number | null;
  hasStep: boolean;
  links: { nextStep: string; checkIn: string; coaching: string; stop: string };
}): FollowupEmail {
  const { day, hasStep, links } = input;
  const first = input.firstName?.trim().split(/\s+/)[0] || null;
  const heading = first ? `Hi ${first},` : "Hi,";
  const setStep: Block = { button: { href: links.nextStep, label: "Set my Next Step" } };
  const openStep: Block = { button: { href: links.nextStep, label: "Open my Next Step" } };
  const end = (lead: Block[], button: Block): Block[] => [
    ...lead,
    button,
    { signOff: "Duane" },
    { smallLink: { lead: "You’re getting this because you asked for follow-up emails from me.", label: "Stop these emails", href: links.stop } },
  ];
  const p = (text: string): Block => ({ p: text });

  let subject: string;
  let preheader: string;
  let body: Block[];
  let button: Block;

  if (day === 1 && !hasStep) {
    subject = "Thank you for taking the audit";
    preheader = "A word about your score, and where to start.";
    body = [
      p(input.score != null ? `Thank you for taking the Aligned Audit yesterday. You scored ${input.score}/100.` : "Thank you for taking the Aligned Audit yesterday."),
      p(`I know ${input.score != null ? "a number like that" : "scores like these"} can sting, or feel like a verdict. Please don’t read ${input.score != null ? "it" : "them"} that way. ${input.score != null ? "It’s" : "They’re"} simply where you’re starting from, and because you scored ${input.score != null ? "it" : "them"} on your own, ${input.score != null ? "it’s" : "they’re"} honest.`),
      p("When I first looked at my own life like this, my instinct was to try to fix everything at once. It didn’t work. What helped was choosing one area, the one where a change would take the most pressure off, and starting there."),
      p("That’s what your Next Step is for. It takes about ten minutes, whenever you’re ready."),
    ];
    button = setStep;
  } else if (day === 1) {
    subject = "You’ve set your Next Step";
    preheader = "One suggestion for this week.";
    body = [
      p("I saw you took the audit and went on to set your Next Step. I wanted to acknowledge that, because a lot of people stop at the scores. Deciding what actually matters to you is often the hardest part."),
      p("My only suggestion for this week is to do the first move. You don’t need to do all of them. When I started making changes in my own life, it was the small things I followed through on that gave me the belief I could do the bigger ones."),
    ];
    button = openStep;
  } else if (day === 3 && !hasStep) {
    subject = "A thought about where to start";
    preheader = "Why people stop after the audit.";
    body = [
      p("Something I’ve noticed, in my own life and in coaching, is that people rarely stop because they don’t care. They stop because the change they’re picturing is so big that it’s hard to know where to begin."),
      p("Your Next Step doesn’t need to be the whole answer. It’s the one change that would start to move you out of where you feel stuck. If it feels too heavy, make it smaller, until it’s something you could start this week."),
    ];
    button = setStep;
  } else if (day === 3) {
    subject = "What might get in the way?";
    preheader = "A question I ask myself.";
    body = [
      p("I wanted to check in on your Next Step, and ask you something I ask myself: what’s most likely to get in the way?"),
      p("For me it has often been something inside rather than outside: old patterns, doubt, the voice that says it won’t work. Sometimes it’s time, money or another person. Whatever it is for you, it helps to name it honestly, and then make sure one of your moves is there to answer it."),
    ];
    button = openStep;
  } else if (day === 7 && !hasStep) {
    subject = "No pressure";
    preheader = "Your map is still there.";
    body = [
      p("It’s been a week since you took the audit. If life has got in the way since then, that’s completely normal, and your map is still there exactly as you left it."),
      p("Whenever you feel ready, setting your Next Step takes about ten minutes."),
    ];
    button = setStep;
  } else if (day === 7) {
    subject = "One week on";
    preheader = "One question: is it closer?";
    body = [
      p("It’s a week since you set your Next Step, so I wanted to ask you one question: is it closer?"),
      p("There’s no wrong answer. If it is, notice what helped. If it isn’t, that’s useful too, because it shows you what to change. Your check-in takes about a minute."),
    ];
    button = { button: { href: links.checkIn, label: "Do my check-in" } };
  } else {
    subject = "Can I help?";
    preheader = "If you’d like someone to think it through with.";
    body = [
      p(
        hasStep
          ? "You’ve set your Next Step, and in my experience, whether it happens usually comes down to what you do when it gets hard."
          : "Most people who take the audit already know, somewhere, what needs to change."
      ),
      p("I know from my own life how much easier it is to move forward with someone to think it through with, and someone who’ll be honest with you when you start to drift. That’s what I do in coaching."),
      p("If you’d like to talk about whether it could help you, reply to this email and tell me a little about what’s in the way. I read every reply myself. Or you can see how coaching works first."),
      p("Whatever you decide, your map and your Next Step stay free, and they’re yours."),
    ];
    button = { button: { href: links.coaching, label: "How coaching works" } };
  }

  return { subject, preheader, heading, blocks: end(body, button), signature: DUANE };
}
