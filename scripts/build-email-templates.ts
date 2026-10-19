// Builds the branded Supabase sign-in emails into supabase/email-templates/,
// from the same design as the console's emails (lib/email-layout.ts).
// Each one is pasted into Supabase -> Authentication -> Emails -> Templates.
//
//   node --experimental-strip-types scripts/build-email-templates.ts [preview.html]
//
// With a path, it also writes a preview page of every email (sign-in emails
// and the console's emails, with sample details) for checking by eye.

import { writeFileSync, mkdirSync } from "node:fs";
import { renderEmail, type Block } from "../lib/email-layout.ts";
import { buildMessage } from "../lib/messages.ts";

// Links go through the-aligned.com/auth/confirm (app/auth/confirm/route.ts),
// so they match the sending domain and work on any device. `next` is where
// the person lands once the link has signed them in.
const link = (type: string, next: string) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${encodeURIComponent(next)}`;

type Template = { file: string; name: string; subject: string; heading: string; preheader: string; blocks: Block[]; footerNote?: string };

export const TEMPLATES: Template[] = [
  {
    file: "invite.html",
    name: "Invite user",
    subject: "Your invitation to the Aligned Protocol",
    heading: "Welcome to the Aligned Protocol",
    preheader: "Your space is ready. Choose a password to get started.",
    blocks: [
      { p: "Hello," },
      { p: "Duane has set up your personal space in the Aligned Protocol — the place we’ll work from together, between our conversations." },
      { button: { href: link("invite", "/reset-password/confirm?welcome=1"), label: "Accept and choose your password" } },
      { p: "Here’s what happens next:" },
      {
        steps: [
          { title: "Choose your password", text: "The button above takes you straight there. It only takes a moment." },
          { title: "Take the Aligned Audit", text: "Ten areas of your life, scored honestly. About ten minutes, with no wrong answers." },
          { title: "See your snapshot", text: "It shows where life feels aligned and where it doesn’t. That’s where we’ll start." },
        ],
      },
      { p: "If you have any questions before then, just reply to this email." },
      { signOff: "Duane" },
    ],
    footerNote: "You’re receiving this because Duane invited you to the Aligned Protocol. The link works once; if it doesn’t, reply and we’ll send a new one.",
  },
  {
    file: "confirmation.html",
    name: "Confirm sign up",
    subject: "Confirm your email for Aligned",
    heading: "Confirm your email",
    preheader: "One click and your account is ready.",
    blocks: [
      { p: "Welcome to Aligned." },
      { p: "Please confirm this is your email address, and your account will be ready to use." },
      { button: { href: link("email", "/"), label: "Confirm my email" } },
      { signOff: "Duane" },
    ],
    footerNote: "If you didn’t create an account, you can ignore this email.",
  },
  {
    file: "recovery.html",
    name: "Reset password",
    subject: "Reset your Aligned password",
    heading: "Choose a new password",
    preheader: "Use this link to set a new password.",
    blocks: [
      { p: "We received a request to reset the password for your Aligned account." },
      { button: { href: link("recovery", "/reset-password/confirm"), label: "Choose a new password" } },
      { small: "This link works once. If it has expired, ask for a new one from the sign-in page." },
    ],
    footerNote: "If you didn’t ask for this, you can ignore this email. Your password won’t change.",
  },
  {
    file: "magic_link.html",
    name: "Magic link",
    subject: "Your Aligned sign-in link",
    heading: "Sign in to Aligned",
    preheader: "Your one-time sign-in link.",
    blocks: [
      { p: "Here’s your link to sign in. It works once." },
      { button: { href: link("email", "/"), label: "Sign me in" } },
    ],
    footerNote: "If you didn’t ask for this, you can ignore this email.",
  },
  {
    file: "email_change.html",
    name: "Change email address",
    // Also what a guest gets when they save their audit by creating an
    // account (their sign-in gains an email), so it reads right either way.
    subject: "Confirm your email for Aligned",
    heading: "Confirm your email",
    preheader: "One click and your account is ready.",
    blocks: [
      {
        p: "{{ if .Email }}You asked to change the email address on your Aligned account from {{ .Email }} to {{ .NewEmail }}.{{ else }}Thanks for taking the Aligned Audit. Confirm this is your email address and your results will be saved to your new account.{{ end }}",
      },
      { button: { href: link("email_change", "/"), label: "Confirm my email" } },
      { signOff: "Duane" },
    ],
    footerNote: "If you didn’t ask for this, you can ignore this email.",
  },
];

const dir = new URL("../supabase/email-templates/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const t of TEMPLATES) {
  writeFileSync(new URL(t.file, dir), renderEmail({ preheader: t.preheader, heading: t.heading, blocks: t.blocks, footerNote: t.footerNote }));
}
writeFileSync(
  new URL("SUBJECTS.md", dir),
  `# Supabase sign-in email templates\n\nBuilt by \`scripts/build-email-templates.ts\` — edit the script, not these files, then rebuild.\nPaste each into Supabase -> Authentication -> Emails -> Templates.\n\n| Supabase template | Subject | File |\n|---|---|---|\n` +
    TEMPLATES.map((t) => `| ${t.name} | ${t.subject} | \`${t.file}\` |`).join("\n") +
    "\n"
);
console.log(`Wrote ${TEMPLATES.length} templates to supabase/email-templates/`);

// Optional preview page of every email, with sample details.
const out = process.argv[2];
if (out) {
  const sampleLink = "https://www.the-aligned.com/coaching";
  const fill = (html: string) =>
    html
      .replaceAll("{{ .SiteURL }}", "https://www.the-aligned.com")
      .replaceAll("{{ .TokenHash }}", "sample")
      // The email-change wording a guest would see when saving their audit.
      .replace(/\{\{ if \.Email \}\}.*?\{\{ else \}\}(.*?)\{\{ end \}\}/g, "$1");
  const items: { title: string; subject: string; html: string }[] = [
    ...TEMPLATES.map((t) => ({
      title: `Sign-in email · ${t.name}`,
      subject: t.subject,
      html: fill(renderEmail({ preheader: t.preheader, heading: t.heading, blocks: t.blocks, footerNote: t.footerNote })),
    })),
    ...[
      buildMessage({ kind: "summary_shared", firstName: "Sam", sessionLabel: "Tue, 27 Oct 2026", coachName: "Duane", link: sampleLink, note: "Really good to see the progress with the Monday money check." }),
      buildMessage({ kind: "session_update", firstName: "Sam", coachName: "Duane", change: "confirmed", when: "Tue, 3 Nov 2026, 19:30 GMT", durationMinutes: 60, location: "Zoom", link: sampleLink }),
      buildMessage({
        kind: "invoice_issued", firstName: "Sam", supplierName: "Aligned Media", number: "AM-0002", total: "£225.00", owed: "£225.00", partPaid: false, due: "2 November 2026",
        bank: { accountName: "Aligned Media", sortCode: "12-34-56", accountNumber: "12345678" }, cardPayments: true, link: sampleLink,
      }),
      buildMessage({ kind: "payment_received", firstName: "Sam", supplierName: "Aligned Media", amount: "£225.00", receivedOn: "28 October 2026", applied: [{ number: "AM-0002", amount: "£225.00" }], unapplied: null, link: sampleLink }),
    ].map((m) => ({ title: "Console email", subject: m.subject, html: m.html })),
  ];
  const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  writeFileSync(
    out,
    `<!doctype html><html><head><meta charset="utf-8"><title>Aligned email previews</title>
<style>body{margin:0;background:#2a2833;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#eee;padding:24px}
h1{font-size:20px;margin:0 0 6px}p.lead{color:#bbb;margin:0 0 24px;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:24px}
.card{background:#1c1b22;border-radius:12px;overflow:hidden}.meta{padding:12px 14px;font-size:13px}.meta b{display:block;color:#D3A758;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
iframe{width:100%;height:760px;border:0;background:#fff}</style></head><body>
<h1>Aligned email previews</h1><p class="lead">Sample details only (Sam is fictional; the bank details are placeholders). Buttons point at the site.</p>
<div class="grid">${items
      .map((i) => `<div class="card"><div class="meta"><b>${i.title}</b>Subject: ${i.subject}</div><iframe srcdoc="${escAttr(i.html)}"></iframe></div>`)
      .join("")}</div></body></html>`
  );
  console.log(`Preview: ${out}`);
}
