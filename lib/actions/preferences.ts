"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getReminderPreference(): Promise<boolean | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("reminders_email").eq("id", user.id).maybeSingle();
  return (data?.reminders_email as boolean | undefined) ?? null;
}

export async function setReminderPreference(on: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { data, error } = await supabase.from("profiles").update({ reminders_email: on }).eq("id", user.id).select("id");
  revalidatePath("/");
  return { ok: !error && !!data?.length };
}

// Reminder emails only go out once Resend and the daily job are configured.
// Until then the switch stays hidden, so nothing implies emails are being sent.
export async function remindersConfigured(): Promise<boolean> {
  return Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM && process.env.CRON_SECRET);
}

// The optional identity statement on My profile, in the member's own words.
// `available` is false until migration 0008 has added the column.
export async function getIdentityStatement(): Promise<{ available: boolean; text: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { available: false, text: null };
  const { data, error } = await supabase.from("profiles").select("identity_statement").eq("id", user.id).maybeSingle();
  if (error) return { available: false, text: null };
  return { available: true, text: ((data?.identity_statement as string | null) ?? "").trim() || null };
}

export async function saveIdentityStatement(text: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const value = text.trim().slice(0, 280) || null;
  const { data, error } = await supabase.from("profiles").update({ identity_statement: value }).eq("id", user.id).select("id");
  revalidatePath("/");
  return { ok: !error && !!data?.length };
}
