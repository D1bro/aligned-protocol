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
