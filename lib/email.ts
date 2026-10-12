import "server-only";

// Sends one email through Resend (https://resend.com). Needs RESEND_API_KEY and
// REMINDER_FROM (e.g. "Aligned Protocol <reminders@the-aligned.com>", a sender
// on the domain verified in Resend) set on Vercel.
export async function sendEmail(input: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM;
  if (!key || !from) return { ok: false as const, reason: "email not configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
  });
  if (!res.ok) return { ok: false as const, reason: `resend ${res.status}` };
  return { ok: true as const };
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.the-aligned.com").replace(/\/$/, "");
