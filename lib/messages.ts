// The emails sent to clients, built only from what's already in the app.
// Private coaching content (notes, reflections, transcripts) is never put in
// an email. A shared session summary is linked by default; the coach can tick
// to include its client-facing wording (exactly what the client sees in the
// app, via clientFacingSummary). Every email can carry a short personal note.

import { renderEmail, renderText, type Block, type Signature } from "./email-layout.ts";

export type Message = { subject: string; text: string; html: string };

// The parts of a shared summary the client sees in the app, and nothing else.
export type SummaryForEmail = {
  focus: string;
  summary: string;
  insights: string[];
  steps: { text: string; due: string | null }[];
  coachSteps: string[];
  startWith: string | null;
  resources: { title: string; url: string }[];
  nextMeeting: string | null;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? v : []);
const longDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })
    : null;

// Pick out what the client sees from a published summary's stored content.
// Hidden follow-ups, conversation points and anything else stay out.
export function clientFacingSummary(content: Record<string, unknown>, nextMeeting: string | null): SummaryForEmail {
  const focus = (content.suggested_focus ?? {}) as Record<string, unknown>;
  return {
    focus: str(content.focus),
    summary: str(content.summary),
    insights: list(content.insights).map(str).filter(Boolean),
    steps: list(content.client_actions)
      .map((a) => ({ text: str((a as Record<string, unknown>).text), due: longDate(str((a as Record<string, unknown>).due_date)) }))
      .filter((a) => a.text),
    coachSteps: list(content.coach_actions)
      .filter((a) => (a as Record<string, unknown>).visible !== false)
      .map((a) => str((a as Record<string, unknown>).text))
      .filter(Boolean),
    startWith: str(focus.area_id) && str(focus.area_name) ? `${str(focus.area_name)}${str(focus.goal) ? ` — a first goal to consider: “${str(focus.goal)}”` : ""}` : null,
    resources: list(content.resources)
      .map((r) => ({ title: str((r as Record<string, unknown>).title), url: str((r as Record<string, unknown>).url) }))
      .filter((r) => r.title),
    nextMeeting: nextMeeting?.trim() || (str((content.next_meeting as Record<string, unknown> | undefined)?.text) ? `Proposed: ${str((content.next_meeting as Record<string, unknown>).text)}` : null),
  };
}

export type MessageInput =
  | {
      kind: "summary_shared";
      firstName: string;
      sessionLabel: string;
      // "Monday" for a session in the last few days, otherwise "26 October".
      sessionRef?: string;
      // "Monday 9 November at 10:00", when the next session is booked.
      nextSession?: string | null;
      coachName: string;
      link: string;
      note?: string | null;
      content?: SummaryForEmail | null;
    }
  | {
      kind: "session_reminder";
      firstName: string;
      coachName: string;
      when: string;
      time: string;
      durationMinutes: number;
      joinUrl: string | null;
      place: string | null;
      steps: string[];
      link: string;
    }
  | {
      kind: "session_update";
      firstName: string;
      coachName: string;
      change: "confirmed" | "proposed" | "rescheduled" | "cancelled";
      when: string;
      previousWhen?: string | null;
      durationMinutes: number;
      location?: string | null;
      link: string;
      note?: string | null;
    }
  | {
      kind: "invoice_issued";
      firstName: string;
      supplierName: string;
      number: string;
      total: string;
      // What's still to pay right now: null when nothing is owed.
      owed: string | null;
      partPaid: boolean;
      due: string;
      bank: { accountName?: string; sortCode?: string; accountNumber?: string } | null;
      cardPayments: boolean;
      link: string;
      note?: string | null;
    }
  | {
      kind: "payment_received";
      firstName: string;
      supplierName: string;
      amount: string;
      receivedOn: string;
      applied: { number: string; amount: string }[];
      refunded?: { amount: string; on: string }[];
      unapplied: string | null;
      link: string;
      note?: string | null;
    };

type Part = Block | null | undefined | false | "";

// The shared Aligned look (lib/email-layout.ts), as HTML and plain text.
function compose(subject: string, heading: string, preheader: string, parts: Part[], footerNote?: string, signature?: Signature): Message {
  const blocks = parts.filter((b): b is Block => Boolean(b));
  return {
    subject,
    html: renderEmail({ preheader, heading, blocks, footerNote, signature }),
    text: renderText({ heading, blocks, footerNote, signature }),
  };
}

// Coaching emails are signed by the coach: first name in the sign-off, full
// name and role in the footer.
const firstOf = (name: string) => name.trim().split(/\s+/)[0] || name;
const coachSignature = (name: string): Signature => ({ name, role: "Coach, Aligned" });

// A personal note from the coach, shown set apart in the email.
const noteBlock = (note?: string | null): Part => (note?.trim() ? { quote: note.trim().slice(0, 1000) } : null);

export function buildMessage(m: MessageInput): Message {
  switch (m.kind) {
    case "summary_shared":
      if (m.content) {
        const c = m.content;
        return compose(
          "Your session notes",
          c.focus || "Your session notes",
          `Notes and next steps from our session on ${m.sessionLabel}.`,
          [
            { p: `Hi ${m.firstName},` },
            { p: `Here are the notes from our session on ${m.sessionLabel}, the same as in your member area.` },
            noteBlock(m.note),
            c.summary ? { p: c.summary } : null,
            c.insights.length ? { small: "What you noticed" } : null,
            c.insights.length ? { box: c.insights.map((x) => `• ${x}`) } : null,
            c.steps.length ? { small: "Your next steps" } : null,
            c.steps.length ? { steps: c.steps.map((x) => ({ title: x.text, text: x.due ? `By ${x.due}` : "" })) } : null,
            c.coachSteps.length ? { small: "What I'll do" } : null,
            c.coachSteps.length ? { box: c.coachSteps.map((x) => `• ${x}`) } : null,
            c.startWith ? { small: "Where to start" } : null,
            c.startWith ? { p: `I'd suggest starting with ${c.startWith}. It's your choice in My plan.` } : null,
            c.resources.length ? { small: "Resources" } : null,
            c.resources.length ? { box: c.resources.map((r) => (r.url ? `${r.title}: ${r.url}` : r.title)) } : null,
            c.nextMeeting ? { small: "Next session" } : null,
            c.nextMeeting ? { p: c.nextMeeting } : null,
            { button: { href: m.link, label: "Open your session notes" } },
            { p: "You can let me know how each step is going from the same page." },
            { signOff: firstOf(m.coachName) },
          ],
          "This email contains your session notes. They're also kept in your member area, behind your sign-in.",
          coachSignature(m.coachName)
        );
      }
      {
        const ref = m.sessionRef ?? null;
        const recent = !!ref && /day$/.test(ref);
        return compose(
          ref ? `Notes from our session on ${ref}` : "Notes from our session",
          "Notes from our session",
          "The notes and the next steps we agreed are in your member area.",
          [
            { p: `Hi ${m.firstName},` },
            { p: `Thanks for ${recent ? ref : ref ? `our session on ${ref}` : "our session"}. I’ve put the notes from our session in your member area, with the next steps we agreed.` },
            noteBlock(m.note),
            { button: { href: m.link, label: "Open your session notes" } },
            {
              p: `When you’ve tried a step, you can tell me how it went from the same page. It helps me prepare for our next session${m.nextSession ? ` on ${m.nextSession}` : ""}.`,
            },
            { signOff: m.nextSession ? `See you then,\n${firstOf(m.coachName)}` : firstOf(m.coachName) },
          ],
          undefined,
          coachSignature(m.coachName)
        );
      }
    case "session_reminder": {
      const where = m.joinUrl ? "Online — use the button below to join" : m.place;
      return compose(
        `Reminder: our session tomorrow at ${m.time}`,
        "See you tomorrow",
        `${m.when} · ${m.durationMinutes} minutes`,
        [
          { p: `Hi ${m.firstName},` },
          { p: "A quick reminder that our next session is tomorrow:" },
          { box: [m.when, `${m.durationMinutes} minutes`, ...(where ? [`Where: ${where}`] : [])] },
          m.joinUrl && { button: { href: m.joinUrl, label: "Join the call" } },
          m.steps.length > 0 && { small: "The steps you agreed last time" },
          m.steps.length > 0 && { box: m.steps.map((x) => `• ${x}`) },
          { p: "Anything you’d like to bring? You can add it under “Before we meet” on your coaching page. It stays private until you share it." },
          m.joinUrl ? { smallLink: { lead: "Your notes and next steps are on", label: "your coaching page", href: m.link } } : { button: { href: m.link, label: "Open your coaching page" } },
          { p: "If the time no longer works, just reply to this email." },
          { signOff: `See you tomorrow,\n${firstOf(m.coachName)}` },
        ],
        undefined,
        coachSignature(m.coachName)
      );
    }
    case "session_update": {
      const details = [`${m.when}`, `${m.durationMinutes} minutes`, ...(m.location?.trim() ? [`Where: ${m.location.trim()}`] : [])];
      const copy: Record<typeof m.change, { subject: string; heading: string; intro: string; outro?: string }> = {
        confirmed: { subject: "Your coaching session is confirmed", heading: "Your session is confirmed", intro: "Our next session is confirmed:" },
        proposed: {
          subject: "A proposed time for your next session",
          heading: "A time for our next session",
          intro: "I’d like to suggest this time for our next session:",
          outro: "Reply to let me know if it works.",
        },
        rescheduled: {
          subject: "Your coaching session has moved",
          heading: "Your session has moved",
          intro: `Our session${m.previousWhen ? ` on ${m.previousWhen}` : ""} has moved to:`,
        },
        cancelled: { subject: "Your coaching session is cancelled", heading: "Your session is cancelled", intro: `Our session on ${m.when} is cancelled.` },
      };
      const c = copy[m.change];
      return compose(c.subject, c.heading, m.change === "cancelled" ? c.intro : `${c.intro} ${m.when}`, [
        { p: `Hi ${m.firstName},` },
        { p: c.intro },
        m.change !== "cancelled" && { box: details },
        c.outro && { p: c.outro },
        noteBlock(m.note),
        { button: { href: m.link, label: "See your coaching page" } },
        { signOff: firstOf(m.coachName) },
      ], undefined, coachSignature(m.coachName));
    }
    case "invoice_issued": {
      const status = !m.owed
        ? `Invoice ${m.number} for ${m.total} has been paid in full — thank you. You can view and download it in your member area.`
        : m.partPaid
          ? `Invoice ${m.number} for ${m.total} has ${m.owed} still to pay, due by ${m.due}. You can view and download it in your member area.`
          : `Invoice ${m.number} for ${m.total} is ready, due by ${m.due}. You can view and download it in your member area.`;
      const bank =
        m.owed && m.bank?.accountName && m.bank.sortCode && m.bank.accountNumber
          ? ["To pay by bank transfer:", `Account name: ${m.bank.accountName}`, `Sort code: ${m.bank.sortCode}`, `Account number: ${m.bank.accountNumber}`, `Reference: ${m.number}`]
          : null;
      return compose(
        `Invoice ${m.number} from ${m.supplierName}`,
        m.owed ? `Invoice ${m.number}` : `Invoice ${m.number} — paid`,
        m.owed ? `${m.owed} due by ${m.due}.` : `Paid in full — thank you.`,
        [
          { p: `Hi ${m.firstName},` },
          { p: status },
          bank && { box: bank },
          m.owed && m.cardPayments && { p: "You can also pay by card from your member area." },
          noteBlock(m.note),
          { button: { href: m.link, label: "View your invoice" } },
          { signOff: `Thank you,\n${m.supplierName}` },
        ]
      );
    }
    case "payment_received":
      return compose(
        "Payment received — thank you",
        "Payment received — thank you",
        `We received your payment of ${m.amount}.`,
        [
          { p: `Hi ${m.firstName},` },
          { p: `Thank you — we received your payment of ${m.amount} on ${m.receivedOn}.` },
          (m.applied.length > 0 || (m.refunded?.length ?? 0) > 0) && {
            box: [
              ...m.applied.map((a) => `${a.amount} paid towards invoice ${a.number}`),
              ...(m.refunded ?? []).map((r) => `${r.amount} refunded to you on ${r.on}`),
            ],
          },
          m.unapplied && { p: `${m.unapplied} hasn’t been put towards an invoice yet. We’ll be in touch about it.` },
          noteBlock(m.note),
          { button: { href: m.link, label: "See your invoices" } },
          { signOff: `Thank you,\n${m.supplierName}` },
        ]
      );
  }
}
