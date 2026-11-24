"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions/admin";
import { alertAddress } from "@/lib/alerts";
import { sendFollowupPreview } from "@/lib/followups";
import { COPY_KEYS, COPY_LABEL, copyProblem, type CopyKey, type FollowupCopy } from "@/lib/followup-content";

// Console → Follow-up emails: Duane's wording for each of the eight emails,
// a preview of one to his own inbox, and the pause switch (migration 0038).

type Result = { ok: true; message?: string } | { ok: false; message: string };
const NOT_INSTALLED = "Couldn’t save. Has database update 0038 been run?";

const clean = (c: FollowupCopy): FollowupCopy => ({
  subject: String(c.subject ?? "").trim(),
  preheader: String(c.preheader ?? "").trim(),
  body: String(c.body ?? "").replace(/\r\n/g, "\n").trim(),
  button: String(c.button ?? "").trim(),
});
const isKey = (k: string): k is CopyKey => (COPY_KEYS as string[]).includes(k);

export async function saveFollowupCopy(key: string, input: FollowupCopy): Promise<Result> {
  const me = await requireAdmin();
  if (!isKey(key)) return { ok: false, message: "That isn’t one of the eight emails." };
  const c = clean(input);
  const problem = copyProblem(c);
  if (problem) return { ok: false, message: problem };
  const supabase = await createClient();
  const { error } = await supabase.from("followup_copy").upsert({ key, ...c, updated_at: new Date().toISOString(), updated_by: me.id });
  if (error) return { ok: false, message: NOT_INSTALLED };
  revalidatePath("/coach/followups");
  return { ok: true, message: "Saved. It goes out in these words from the next 9:21 send." };
}

export async function resetFollowupCopy(key: string): Promise<Result> {
  await requireAdmin();
  if (!isKey(key)) return { ok: false, message: "That isn’t one of the eight emails." };
  const supabase = await createClient();
  const { error } = await supabase.from("followup_copy").delete().eq("key", key);
  if (error) return { ok: false, message: NOT_INSTALLED };
  revalidatePath("/coach/followups");
  return { ok: true, message: "Back to the original wording." };
}

// The email as it stands in the editor (saved or not), to Duane's inbox.
export async function previewFollowupCopy(key: string, input: FollowupCopy): Promise<Result> {
  const me = await requireAdmin();
  if (!isKey(key)) return { ok: false, message: "That isn’t one of the eight emails." };
  const c = clean(input);
  const problem = copyProblem(c);
  if (problem) return { ok: false, message: problem };
  const to = alertAddress();
  if (!to) return { ok: false, message: "Not sent: add ENQUIRY_NOTIFY (your email address) in Vercel first." };
  const first = me.full_name?.trim().split(/\s+/)[0] ?? null;
  const result = await sendFollowupPreview(to, first, key, c, `Preview · ${COPY_LABEL[key].split(" (")[0]}`);
  return result.ok ? { ok: true, message: `Sent to ${to}.` } : { ok: false, message: `Not sent: ${result.reason}` };
}

export async function setFollowupsPaused(paused: boolean): Promise<Result> {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { error } = paused
    ? await supabase.from("followup_pauses").insert({ started_by: me.id })
    : await supabase.from("followup_pauses").update({ ended_at: new Date().toISOString() }).is("ended_at", null);
  // A second "pause" while already paused hits the one-open-pause rule: fine.
  if (error && error.code !== "23505") return { ok: false, message: NOT_INSTALLED };
  revalidatePath("/coach/followups");
  revalidatePath("/coach/health");
  return { ok: true, message: paused ? "Paused. Nothing will send until you resume." : "Resumed. The next send is at 9:21am." };
}
