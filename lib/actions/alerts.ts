"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/actions/admin";
import { sendAlert } from "@/lib/alerts";
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
