import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Sends one email through Resend (https://resend.com). Needs RESEND_API_KEY and
// REMINDER_FROM (e.g. "Aligned Protocol <reminders@the-aligned.com>", a sender
// on the domain verified in Resend) set on Vercel.
//
// For local testing only: with EMAIL_OUTBOX_DIR set (and not in production),
// emails are written to that folder as .html/.txt files instead of being sent.

type Outgoing = { to: string; subject: string; html: string; text: string; replyTo?: string | null };
type Sent = { ok: true; id: string | null } | { ok: false; reason: string };

export function emailStatus(): { ready: boolean; mode: "resend" | "outbox" | "off"; reason?: string } {
  const outbox = process.env.EMAIL_OUTBOX_DIR;
  if (outbox && process.env.NODE_ENV !== "production") return { ready: true, mode: "outbox", reason: "Test mode: emails are saved to a local folder, not sent." };
  if (process.env.RESEND_API_KEY && process.env.REMINDER_FROM) return { ready: true, mode: "resend" };
  return { ready: false, mode: "off", reason: "Email isn’t set up yet (Resend), so nothing can be sent." };
}

export async function sendEmail(input: Outgoing): Promise<Sent> {
  const status = emailStatus();
  if (status.mode === "outbox") {
    const dir = process.env.EMAIL_OUTBOX_DIR!;
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${input.to.replace(/[^\w.@-]/g, "_")}`;
    await mkdir(dir, { recursive: true });
    const head = `To: ${input.to}\nReply-To: ${input.replyTo ?? ""}\nSubject: ${input.subject}\n\n`;
    await writeFile(path.join(dir, `${id}.txt`), head + input.text);
    await writeFile(path.join(dir, `${id}.html`), input.html);
    return { ok: true, id: `outbox:${id}` };
  }
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM;
  if (!key || !from) return { ok: false, reason: "email not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    if (!res.ok) return { ok: false, reason: `resend ${res.status}` };
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: json.id ?? null };
  } catch {
    return { ok: false, reason: "couldn’t reach Resend" };
  }
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.the-aligned.com").replace(/\/$/, "");
