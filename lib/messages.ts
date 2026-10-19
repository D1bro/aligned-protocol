// The emails sent to clients, built only from what's already in the app.
// Private coaching content (summaries, notes) is never put in an email: the
// email says something is ready and links to the member area, where it's
// behind sign-in. Every email can carry a short personal note from the coach.

import { renderEmail, renderText, type Block } from "./email-layout.ts";

export type Message = { subject: string; text: string; html: string };

export type MessageInput =
  | { kind: "summary_shared"; firstName: string; sessionLabel: string; coachName: string; link: string; note?: string | null }
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
function compose(subject: string, heading: string, preheader: string, parts: Part[], footerNote?: string): Message {
  const blocks = parts.filter((b): b is Block => Boolean(b));
  return {
    subject,
    html: renderEmail({ preheader, heading, blocks, footerNote }),
    text: renderText({ heading, blocks, footerNote }),
  };
}

// A personal note from the coach, shown set apart in the email.
const noteBlock = (note?: string | null): Part => (note?.trim() ? { quote: note.trim().slice(0, 1000) } : null);

export function buildMessage(m: MessageInput): Message {
  switch (m.kind) {
    case "summary_shared":
      return compose(
        "Your session notes are ready",
        "Your session notes are ready",
        `Notes and next steps from our session on ${m.sessionLabel}.`,
        [
          { p: `Hi ${m.firstName},` },
          { p: `The notes from our session on ${m.sessionLabel} are ready in your member area, with the next steps we agreed.` },
          noteBlock(m.note),
          { button: { href: m.link, label: "Read your session notes" } },
          { p: "You can let me know how each step is going from the same page." },
          { signOff: m.coachName },
        ]
      );
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
        { signOff: m.coachName },
      ]);
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
