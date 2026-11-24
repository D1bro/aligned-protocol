// The follow-up emails after the audit (Duane, 24 Nov 2026): what each one
// says, which one is due, and where everyone is in the sequence. Kept free of
// server-only imports so it can be tested directly (tests/followups.test.ts)
// and used by the console's editor in the browser.
//
// The wording below is the original, agreed with Duane in the doc "After the
// audit: follow-up emails". He can change any of it in Console → Follow-up
// emails (stored in followup_copy, migration 0038); what he saves there is
// used instead, and "Back to the original" returns to this.
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

// --- Dates -------------------------------------------------------------------

// Whole calendar days from one YYYY-MM-DD date to another.
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

// Days between `start` and `today` that fell inside a pause (London dates;
// an open pause runs to today). These don't count towards day 1, 3, 7 or 10.
export function pausedDaysSince(start: string, today: string, pauses: { from: string; to: string | null }[]): number {
  let total = 0;
  for (const p of pauses) {
    const from = p.from > start ? p.from : start;
    const to = !p.to || p.to > today ? today : p.to;
    total += Math.max(0, daysBetween(from, to));
  }
  return total;
}

// --- Which one is due ----------------------------------------------------------

// Which follow-up (if any) goes today. `start` is the London date day 0
// counts from: the later of their first finished audit and the day they
// asked for these emails. `pausedDays` is pausedDaysSince(...).
export function dueFollowup(input: {
  start: string;
  today: string;
  sent: number[];
  hasStep: boolean;
  checkinEmailOn: boolean;
  pausedDays?: number;
}): FollowupDay | null {
  const days = daysBetween(input.start, input.today) - (input.pausedDays ?? 0);
  const day = [...FOLLOWUP_DAYS].reverse().find((d) => d <= days);
  if (!day || days - day > GRACE_DAYS || input.sent.includes(day)) return null;
  // Day 7 asks "is it closer?", which their weekly check-in email already
  // does: don't send both.
  if (day === 7 && input.hasStep && input.checkinEmailOn) return null;
  return day;
}

// Where one person is with each of the four emails, for the console.
export type DayState =
  | { day: FollowupDay; state: "sent"; date: string }
  | { day: FollowupDay; state: "failed"; date: string; reason: string | null }
  | { day: FollowupDay; state: "next"; date: string } // goes at the next 9:21 send
  | { day: FollowupDay; state: "due"; date: string } // later, on this date (if nothing is paused)
  | { day: FollowupDay; state: "skipped"; reason: string };

export function sequenceDays(input: {
  start: string;
  today: string;
  pausedDays: number;
  sent: Partial<Record<FollowupDay, { status: "sent" | "failed" | "queued"; date: string; reason: string | null }>>;
  hasStep: boolean;
  checkinEmailOn: boolean;
}): DayState[] {
  const days = daysBetween(input.start, input.today) - input.pausedDays;
  const latest = [...FOLLOWUP_DAYS].reverse().find((d) => d <= days);
  return FOLLOWUP_DAYS.map((day): DayState => {
    const s = input.sent[day];
    if (s) return s.status === "failed" ? { day, state: "failed", date: s.date, reason: s.reason } : { day, state: "sent", date: s.date };
    const checkinCovers = day === 7 && input.hasStep && input.checkinEmailOn;
    if (day > days) {
      return checkinCovers
        ? { day, state: "skipped", reason: "Their weekly check-in email asks the same, so this one won’t go." }
        : { day, state: "due", date: addDays(input.today, day - days) };
    }
    if (day === latest && days - day <= GRACE_DAYS) {
      return checkinCovers ? { day, state: "skipped", reason: "Their weekly check-in email asks the same." } : { day, state: "next", date: input.today };
    }
    return { day, state: "skipped", reason: checkinCovers ? "Their weekly check-in email asks the same." : "Its day passed without a send." };
  });
}

// --- The words -----------------------------------------------------------------

export type CopyKey = "1-new" | "1-set" | "3-new" | "3-set" | "7-new" | "7-set" | "10-new" | "10-set";
export const copyKey = (day: FollowupDay, hasStep: boolean): CopyKey => `${day}-${hasStep ? "set" : "new"}` as CopyKey;
export const COPY_KEYS: CopyKey[] = FOLLOWUP_DAYS.flatMap((d) => [copyKey(d, false), copyKey(d, true)]);

// body: paragraphs separated by a blank line. [score] is their overall
// score (a sentence holding it is left out if there's no score); [first name]
// is their first name.
export type FollowupCopy = { subject: string; preheader: string; body: string; button: string };

// Where each email's button goes (fixed; only its label is editable).
export const BUTTON_GOES_TO: Record<CopyKey, "nextStep" | "checkIn" | "coaching"> = {
  "1-new": "nextStep",
  "1-set": "nextStep",
  "3-new": "nextStep",
  "3-set": "nextStep",
  "7-new": "nextStep",
  "7-set": "checkIn",
  "10-new": "coaching",
  "10-set": "coaching",
};
export const BUTTON_PLACE = { nextStep: "their Next Step", checkIn: "their weekly check-in", coaching: "the Coaching page" } as const;

export const COPY_LABEL: Record<CopyKey, string> = {
  "1-new": "Day 1 · no Next Step yet",
  "1-set": "Day 1 · Next Step set",
  "3-new": "Day 3 · no Next Step yet",
  "3-set": "Day 3 · Next Step set",
  "7-new": "Day 7 · no Next Step yet",
  "7-set": "Day 7 · Next Step set (only if their check-in email is off)",
  "10-new": "Day 10 · no Next Step yet",
  "10-set": "Day 10 · Next Step set",
};

const p = (...paras: string[]) => paras.join("\n\n");
const COACHING_TAIL = [
  "I know from my own life how much easier it is to move forward with someone to think it through with, and someone who’ll be honest with you when you start to drift. That’s what I do in coaching.",
  "If you’d like to talk about whether it could help you, reply to this email and tell me a little about what’s in the way. I read every reply myself. Or you can see how coaching works first.",
  "Whatever you decide, your map and your Next Step stay free, and they’re yours.",
];

export const DEFAULT_COPY: Record<CopyKey, FollowupCopy> = {
  "1-new": {
    subject: "Thank you for taking the audit",
    preheader: "A word about your score, and where to start.",
    body: p(
      "Thank you for taking the Aligned Audit yesterday. You scored [score]/100.",
      "I know a number like that can sting, or feel like a verdict. Please don’t read it that way. It’s simply where you’re starting from, and because you scored it on your own, it’s honest.",
      "When I first looked at my own life like this, my instinct was to try to fix everything at once. It didn’t work. What helped was choosing one area, the one where a change would take the most pressure off, and starting there.",
      "That’s what your Next Step is for. It takes about ten minutes, whenever you’re ready."
    ),
    button: "Set my Next Step",
  },
  "1-set": {
    subject: "You’ve set your Next Step",
    preheader: "One suggestion for this week.",
    body: p(
      "I saw you took the audit and went on to set your Next Step. I wanted to acknowledge that, because a lot of people stop at the scores. Deciding what actually matters to you is often the hardest part.",
      "My only suggestion for this week is to do the first move. You don’t need to do all of them. When I started making changes in my own life, it was the small things I followed through on that gave me the belief I could do the bigger ones."
    ),
    button: "Open my Next Step",
  },
  "3-new": {
    subject: "A thought about where to start",
    preheader: "Why people stop after the audit.",
    body: p(
      "Something I’ve noticed, in my own life and in coaching, is that people rarely stop because they don’t care. They stop because the change they’re picturing is so big that it’s hard to know where to begin.",
      "Your Next Step doesn’t need to be the whole answer. It’s the one change that would start to move you out of where you feel stuck. If it feels too heavy, make it smaller, until it’s something you could start this week."
    ),
    button: "Set my Next Step",
  },
  "3-set": {
    subject: "What might get in the way?",
    preheader: "A question I ask myself.",
    body: p(
      "I wanted to check in on your Next Step, and ask you something I ask myself: what’s most likely to get in the way?",
      "For me it has often been something inside rather than outside: old patterns, doubt, the voice that says it won’t work. Sometimes it’s time, money or another person. Whatever it is for you, it helps to name it honestly, and then make sure one of your moves is there to answer it."
    ),
    button: "Open my Next Step",
  },
  "7-new": {
    subject: "No pressure",
    preheader: "Your map is still there.",
    body: p(
      "It’s been a week since you took the audit. If life has got in the way since then, that’s completely normal, and your map is still there exactly as you left it.",
      "Whenever you feel ready, setting your Next Step takes about ten minutes."
    ),
    button: "Set my Next Step",
  },
  "7-set": {
    subject: "One week on",
    preheader: "One question: is it closer?",
    body: p(
      "It’s a week since you set your Next Step, so I wanted to ask you one question: is it closer?",
      "There’s no wrong answer. If it is, notice what helped. If it isn’t, that’s useful too, because it shows you what to change. Your check-in takes about a minute."
    ),
    button: "Do my check-in",
  },
  "10-new": {
    subject: "Can I help?",
    preheader: "If you’d like someone to think it through with.",
    body: p("Most people who take the audit already know, somewhere, what needs to change.", ...COACHING_TAIL),
    button: "How coaching works",
  },
  "10-set": {
    subject: "Can I help?",
    preheader: "If you’d like someone to think it through with.",
    body: p("You’ve set your Next Step, and in my experience, whether it happens usually comes down to what you do when it gets hard.", ...COACHING_TAIL),
    button: "How coaching works",
  },
};

// What's wrong with an edited email, if anything (also checked by the
// database, migration 0038).
export function copyProblem(c: FollowupCopy): string | null {
  if (!c.subject.trim()) return "Give it a subject.";
  if (c.subject.length > 120) return "Keep the subject under 120 characters.";
  if (c.preheader.length > 160) return "Keep the preview line under 160 characters.";
  if (!c.body.trim()) return "Write at least one paragraph.";
  if (c.body.length > 4000) return "That’s too long for a short email (4,000 characters at most).";
  if (paragraphs(c.body).length > 8) return "Eight paragraphs at most.";
  if (!c.button.trim()) return "Give the button a label.";
  if (c.button.length > 40) return "Keep the button label under 40 characters.";
  const unknown = c.body.match(/\[(?!score\]|first name\])[^\]\n]{1,30}\]/i);
  if (unknown) return `${unknown[0]} isn’t something the email can fill in. Use [first name] or [score].`;
  return null;
}

// The ten areas by name. An edit that names one gets a warning in the
// console: these emails go to everyone, so they should never point at the
// area someone chose.
const AREA_NAMES = [
  "Health & Energy", "Mindset & Thinking", "Confidence & Self-Belief", "Relationships & Connection", "Career, Work & Business",
  "Money & Stability", "Purpose & Direction", "Daily Structure & Discipline", "Emotional Wellbeing", "Self-Respect & Identity",
];
export function areaNamed(c: FollowupCopy): string | null {
  const text = `${c.subject}\n${c.preheader}\n${c.body}`.toLowerCase();
  return AREA_NAMES.find((a) => text.includes(a.toLowerCase())) ?? null;
}

export const paragraphs = (body: string) => body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

// A paragraph with [score] filled in, or without the sentence that holds it
// when there's no score.
function fill(text: string, first: string | null, score: number | null): string {
  let t = text.replace(/\[first name\]/gi, first ?? "there");
  if (/\[score\]/i.test(t)) {
    t = score != null
      ? t.replace(/\[score\]/gi, String(score))
      : t.split(/(?<=[.!?])\s+/).filter((s) => !/\[score\]/i.test(s)).join(" ");
  }
  return t.trim();
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
  copy?: FollowupCopy | null; // Duane's edited wording, if any
}): FollowupEmail {
  const key = copyKey(input.day, input.hasStep);
  const c = input.copy ?? DEFAULT_COPY[key];
  const first = input.firstName?.trim().split(/\s+/)[0] || null;
  const body = paragraphs(c.body).map((x) => fill(x, first, input.score)).filter(Boolean);
  const blocks: Block[] = [
    ...body.map((text): Block => ({ p: text })),
    { button: { href: input.links[BUTTON_GOES_TO[key]], label: c.button.trim() } },
    { signOff: "Duane" },
    { smallLink: { lead: "You’re getting this because you asked for follow-up emails from me.", label: "Stop these emails", href: input.links.stop } },
  ];
  return {
    subject: fill(c.subject, first, input.score),
    preheader: c.preheader.trim() ? fill(c.preheader, first, input.score) : "",
    heading: first ? `Hi ${first},` : "Hi,",
    blocks,
    signature: DUANE,
  };
}
