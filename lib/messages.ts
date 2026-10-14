// The emails sent to clients, built only from what's already in the app.
// Private coaching content (summaries, notes) is never put in an email: the
// email says something is ready and links to the member area, where it's
// behind sign-in. Every email can carry a short personal note from the coach.

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
      unapplied: string | null;
      link: string;
      note?: string | null;
    };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Paragraphs of plain text -> the same email as text and simple HTML.
function compose(subject: string, paras: (string | null | undefined | false)[], link: { href: string; label: string }, signOff: string): Message {
  const body = paras.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  const text = [...body, `${link.label}: ${link.href}`, signOff].join("\n\n");
  const html = [
    `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1f;max-width:560px">`,
    ...body.map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`),
    `<p style="margin:20px 0"><a href="${esc(link.href)}" style="background:#D3A758;color:#100F18;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${esc(link.label)}</a></p>`,
    `<p style="margin:0 0 14px">${esc(signOff).replace(/\n/g, "<br>")}</p>`,
    `</div>`,
  ].join("");
  return { subject, text, html };
}

const noteBlock = (note?: string | null) => (note?.trim() ? note.trim().slice(0, 1000) : null);

export function buildMessage(m: MessageInput): Message {
  switch (m.kind) {
    case "summary_shared":
      return compose(
        "Your session notes are ready",
        [
          `Hi ${m.firstName},`,
          `The notes from our session on ${m.sessionLabel} are ready in your member area, with the next steps we agreed.`,
          noteBlock(m.note),
          "You can let me know how each step is going from the same page.",
        ],
        { href: m.link, label: "Read your session notes" },
        m.coachName
      );
    case "session_update": {
      const where = m.location?.trim() ? `\nWhere: ${m.location.trim()}` : "";
      const details = `${m.when} (UK time), ${m.durationMinutes} minutes${where}`;
      const lines: Record<typeof m.change, [string, string]> = {
        confirmed: ["Your coaching session is confirmed", `Our next session is confirmed:\n${details}`],
        proposed: ["A proposed time for your next session", `I’d like to suggest this time for our next session:\n${details}\n\nReply to let me know if it works.`],
        rescheduled: [
          "Your coaching session has moved",
          `Our session${m.previousWhen ? ` on ${m.previousWhen}` : ""} has moved to:\n${details}`,
        ],
        cancelled: ["Your coaching session is cancelled", `Our session on ${m.when} (UK time) is cancelled.`],
      };
      const [subject, main] = lines[m.change];
      return compose(subject, [`Hi ${m.firstName},`, main, noteBlock(m.note)], { href: m.link, label: "See your coaching page" }, m.coachName);
    }
    case "invoice_issued": {
      const bank =
        m.bank?.accountName && m.bank.sortCode && m.bank.accountNumber
          ? `To pay by bank transfer:\nAccount name: ${m.bank.accountName}\nSort code: ${m.bank.sortCode}\nAccount number: ${m.bank.accountNumber}\nReference: ${m.number}`
          : null;
      return compose(
        `Invoice ${m.number} from ${m.supplierName}`,
        [
          `Hi ${m.firstName},`,
          `Invoice ${m.number} for ${m.total} is ready, due by ${m.due}. You can view and download it in your member area.`,
          bank,
          m.cardPayments ? "You can also pay by card from your member area." : null,
          noteBlock(m.note),
        ],
        { href: m.link, label: "View your invoice" },
        `Thank you,\n${m.supplierName}`
      );
    }
    case "payment_received":
      return compose(
        `Payment received — thank you`,
        [
          `Hi ${m.firstName},`,
          `Thank you — we received your payment of ${m.amount} on ${m.receivedOn}.`,
          m.applied.length ? m.applied.map((a) => `${a.amount} paid towards invoice ${a.number}`).join("\n") : null,
          m.unapplied ? `${m.unapplied} hasn’t been put towards an invoice yet. We’ll be in touch about it.` : null,
          noteBlock(m.note),
        ],
        { href: m.link, label: "See your invoices" },
        `Thank you,\n${m.supplierName}`
      );
  }
}
