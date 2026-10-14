"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, SITE_URL } from "@/lib/email";

// Academy progress, Tools answers and coaching enquiries for the signed-in
// person. Content itself lives in lib/learn-content.ts.

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

// `private`: kept from their coach. By default a reflection is shared with the
// member's assigned coach (migration 0009).
export type LessonProgress = { lesson_slug: string; reflection: string | null; completed_at: string | null; private: boolean };

export async function getLessonProgress(): Promise<LessonProgress[]> {
  const { supabase, userId } = await me();
  if (!userId) return [];
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_slug, reflection, completed_at, private")
    .eq("client_id", userId);
  return (data ?? []) as LessonProgress[];
}

export async function saveLesson(
  lessonSlug: string,
  reflection: string,
  complete: boolean,
  keepPrivate: boolean
): Promise<{ ok: boolean; message?: string }> {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, message: "Please sign in again." };
  const row: Record<string, unknown> = {
    client_id: userId,
    lesson_slug: lessonSlug,
    reflection: reflection.trim() || null,
    private: keepPrivate,
    updated_at: new Date().toISOString(),
  };
  if (complete) row.completed_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("lesson_progress")
    .upsert(row, { onConflict: "client_id,lesson_slug" })
    .select("id");
  revalidatePath("/learn", "layout");
  if (error || !data?.length) return { ok: false, message: "Couldn’t save — try again." };
  return { ok: true };
}

export type ToolEntry = { tool_slug: string; answers: Record<string, string>; updated_at: string };

export async function getToolEntries(): Promise<ToolEntry[]> {
  const { supabase, userId } = await me();
  if (!userId) return [];
  const { data } = await supabase.from("tool_entries").select("tool_slug, answers, updated_at").eq("client_id", userId);
  return (data ?? []) as ToolEntry[];
}

export async function saveToolEntry(toolSlug: string, answers: Record<string, string>): Promise<{ ok: boolean }> {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false };
  const clean = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  const { data, error } = await supabase
    .from("tool_entries")
    .upsert(
      { client_id: userId, tool_slug: toolSlug, answers: clean, updated_at: new Date().toISOString() },
      { onConflict: "client_id,tool_slug" }
    )
    .select("id");
  revalidatePath("/tools", "layout");
  return { ok: !error && !!data?.length };
}

export type Enquiry = {
  id: string;
  wants_help: string;
  tried: string | null;
  availability: string | null;
  status: "new" | "contacted" | "booked" | "closed";
  created_at: string;
};

export async function getMyEnquiries(): Promise<Enquiry[]> {
  const { supabase, userId } = await me();
  if (!userId) return [];
  const { data } = await supabase
    .from("coaching_enquiries")
    .select("id, wants_help, tried, availability, status, created_at")
    .eq("client_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Enquiry[];
}

export async function sendCoachingEnquiry(input: {
  wantsHelp: string;
  tried: string;
  availability: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, message: "Please sign in again." };
  const wantsHelp = input.wantsHelp.trim();
  if (!wantsHelp) return { ok: false, message: "Tell us what you’d like help with." };
  const { data, error } = await supabase
    .from("coaching_enquiries")
    .insert({
      client_id: userId,
      wants_help: wantsHelp.slice(0, 4000),
      tried: input.tried.trim().slice(0, 4000) || null,
      availability: input.availability.trim().slice(0, 1000) || null,
    })
    .select("id");
  revalidatePath("/coaching");
  revalidatePath("/coach");
  if (error || !data?.length) return { ok: false, message: "Couldn’t send — try again." };
  // A heads-up for Duane (set ENQUIRY_NOTIFY on Vercel). The enquiry itself stays in the app.
  const notify = process.env.ENQUIRY_NOTIFY;
  if (notify) {
    const link = `${SITE_URL}/coach`;
    await sendEmail({
      to: notify,
      subject: "New coaching enquiry",
      text: `Someone has asked about the Focus Series. Read it in the coach dashboard: ${link}`,
      html: `<p>Someone has asked about the Focus Series.</p><p><a href="${link}">Read it in the coach dashboard</a></p>`,
    }).catch(() => null);
  }
  return { ok: true };
}
