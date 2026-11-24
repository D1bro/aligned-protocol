"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/actions/admin";
import { alertAddress, sendAlert } from "@/lib/alerts";
import { loadCopy, sendFollowupPreviews } from "@/lib/followups";
import { createAdminClient } from "@/lib/supabase/admin";
import { testAlert } from "@/lib/alert-content";
import { SITE_URL } from "@/lib/email";

// Site health → "Send a test alert": proves the whole path (Vercel settings,
// Resend, the inbox) works, and shows Resend's reason when it doesn't.
export async function sendTestAlert(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const result = await sendAlert("test", testAlert(SITE_URL));
  revalidatePath("/coach/health");
  return result.ok
    ? { ok: true, message: "Sent. Check your inbox (and spam) in a minute." }
    : { ok: false, message: `Not sent: ${result.reason ?? "unknown reason"}` };
}

// Site health → "Send me the follow-up emails": all eight, to the alert
// address, so Duane can read them as members will.
export async function sendFollowupPreview(): Promise<{ ok: boolean; message: string }> {
  const me = await requireAdmin();
  const to = alertAddress();
  if (!to) return { ok: false, message: "Not sent: add ENQUIRY_NOTIFY (your email address) in Vercel first." };
  const first = me.full_name?.trim().split(/\s+/)[0] ?? null;
  const { copy } = await loadCopy(createAdminClient());
  const { sent, failed } = await sendFollowupPreviews(to, first, copy);
  if (!sent) return { ok: false, message: `Not sent: ${failed ?? "unknown reason"}` };
  return {
    ok: !failed,
    message: failed ? `${sent} of 8 sent to ${to}; the rest failed: ${failed}` : `All 8 sent to ${to}. They’re marked [Preview] in the subject.`,
  };
}
