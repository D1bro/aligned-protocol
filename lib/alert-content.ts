// The words of each alert email to Duane. Kept free of server-only imports
// so the wording can be tested directly (tests/alert-content.test.ts).
import type { Block } from "./email-layout.ts";

export type AlertKind = "signup" | "audit" | "enquiry" | "test";
export type AlertMessage = { subject: string; heading: string; blocks: Block[] };

// How they joined: straight to sign-up, or after taking the audit as a guest.
export type SignupRoute = "direct" | "after-audit" | "saved-plan";

export type Progress = {
  score: number | null; // latest completed audit, out of 100
  auditNumber: number | null;
  area: string | null; // where they chose to start
  step: string | null; // their Next Step, if they've written one
};

const who = (name: string | null, email: string | null) => (name?.trim() || email?.trim() || "Someone");

function progressLines(p: Progress | null): string[] {
  if (!p || p.score == null) return ["No audit finished yet."];
  const lines = [`Audit ${p.auditNumber ?? 1}: ${p.score}/100`];
  if (p.area) lines.push(`Starting with: ${p.area}`);
  if (p.step) lines.push(`Next Step: ${p.step}`);
  return lines;
}

const ROUTE: Record<SignupRoute, string> = {
  direct: "Signed up from the sign-up page.",
  "after-audit": "Started the audit as a guest, then made an account.",
  "saved-plan": "Took the audit as a guest, then saved their plan to a new account.",
};

export function signupAlert(input: {
  name: string | null;
  email: string | null;
  route: SignupRoute;
  progress: Progress | null;
  followups?: boolean; // ticked "Send me a few short emails from Duane"
  recordUrl: string;
}): AlertMessage {
  const person = who(input.name, input.email);
  const heading = `New sign-up: ${person}`;
  const blocks: Block[] = [
    { box: [`Name: ${input.name?.trim() || "—"}`, `Email: ${input.email?.trim() || "—"}`] },
    { p: ROUTE[input.route] },
    ...(input.followups != null
      ? [{ p: input.followups ? "They asked for your follow-up emails: the first goes the morning after their audit." : "They didn’t ask for follow-up emails, so none will go. A personal note from you is the follow-up." } as Block]
      : []),
    { box: progressLines(input.progress) },
    { button: { href: input.recordUrl, label: "Open their record" } },
    { small: "They may still need to confirm their email address before they can sign in." },
  ];
  return { subject: heading, heading, blocks };
}

export function auditAlert(input: {
  name: string | null;
  email: string | null;
  score: number;
  auditNumber: number;
  previousScore: number | null;
  recordUrl: string;
}): AlertMessage {
  const person = who(input.name, input.email);
  const change =
    input.previousScore != null
      ? ` (${input.score - input.previousScore >= 0 ? "+" : ""}${input.score - input.previousScore} since their last)`
      : "";
  const heading = `${person} finished audit ${input.auditNumber}: ${input.score}/100`;
  const blocks: Block[] = [
    { p: `${person} has just finished their ${input.auditNumber === 1 ? "first" : `number ${input.auditNumber}`} Aligned Audit, scoring ${input.score}/100${change}.` },
    ...(input.email ? [{ box: [`Email: ${input.email}`] } as Block] : []),
    { button: { href: input.recordUrl, label: "Open their record" } },
  ];
  return { subject: heading, heading, blocks };
}

export function enquiryAlert(input: {
  name: string | null;
  email: string | null;
  wantsHelp: string;
  tried: string | null;
  availability: string | null;
  enquiriesUrl: string;
}): AlertMessage {
  const person = who(input.name, input.email);
  const heading = `New coaching enquiry from ${person}`;
  const blocks: Block[] = [
    { box: [`Name: ${input.name?.trim() || "—"}`, `Email: ${input.email?.trim() || "—"}`] },
    { p: "What they’d like help with:" },
    { quote: input.wantsHelp },
    ...(input.tried ? [{ p: "What they’ve tried so far:" } as Block, { quote: input.tried } as Block] : []),
    ...(input.availability ? [{ p: `When suits them for a call: ${input.availability}` } as Block] : []),
    { button: { href: input.enquiriesUrl, label: "Open Enquiries" } },
    { small: input.email ? "Reply to this email to write straight back to them, then mark it Contacted." : "Reply from Enquiries, then mark it Contacted." },
  ];
  return { subject: heading, heading, blocks };
}

export function testAlert(siteUrl: string): AlertMessage {
  const heading = "Test alert from Site health";
  return {
    subject: heading,
    heading,
    blocks: [
      { p: "This is a test. If you can read it, alerts for new sign-ups, finished audits and coaching enquiries will reach you here." },
      { button: { href: `${siteUrl}/coach/health`, label: "Back to Site health" } },
    ],
  };
}
