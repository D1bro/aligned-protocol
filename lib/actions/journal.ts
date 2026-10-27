"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canUseDailyAlignment, isAlignmentDate } from "@/lib/alignment";
import { getMyAccess } from "@/lib/actions/membership";

// The private journal (migration 0022): part of Aligned Practice and
// Momentum. Only the writer can read it; coaches and admins can't. After a
// membership ends, entries stay theirs to read and export.

export type JournalEntry = { id: string; entry_date: string; prompt: string | null; body: string; created_at: string; updated_at: string };
type Result = { ok: true; entry?: JournalEntry } | { ok: false; message: string };

async function member(writing: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");
  if (writing) {
    const [{ data: profile }, access] = await Promise.all([supabase.from("profiles").select("role").eq("id", user.id).single(), getMyAccess()]);
    if (!canUseDailyAlignment(profile?.role, access.tier)) return null;
  }
  return { supabase, userId: user.id };
}

// Newest first. `available` is false before migration 0022 has run.
export async function getJournal(limit = 60): Promise<{ available: boolean; entries: JournalEntry[] }> {
  const m = await member(false);
  if (!m) return { available: false, entries: [] };
  const { data, error } = await m.supabase
    .from("journal_entries")
    .select("id, entry_date, prompt, body, created_at, updated_at")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return error ? { available: false, entries: [] } : { available: true, entries: (data ?? []) as JournalEntry[] };
}

export async function saveJournalEntry(input: { id?: string | null; entryDate: string; prompt: string | null; body: string }): Promise<Result> {
  const m = await member(true);
  if (!m) return { ok: false, message: "The journal is part of Aligned Practice. Your saved entries are still here to read." };
  const body = input.body.trim();
  if (!body) return { ok: false, message: "Write something first." };
  if (body.length > 20000) return { ok: false, message: "That’s longer than one entry can hold. Split it into two." };
  if (!isAlignmentDate(input.entryDate)) return { ok: false, message: "Choose a date." };
  const row = { entry_date: input.entryDate, prompt: input.prompt?.trim().slice(0, 300) || null, body };
  const query = input.id
    ? m.supabase.from("journal_entries").update(row).eq("id", input.id)
    : m.supabase.from("journal_entries").insert({ ...row, client_id: m.userId });
  const { data, error } = await query.select("id, entry_date, prompt, body, created_at, updated_at").single();
  if (error || !data) return { ok: false, message: "Couldn’t save — your words are still here. Try again." };
  revalidatePath("/alignment/journal");
  return { ok: true, entry: data as JournalEntry };
}

export async function deleteJournalEntry(id: string): Promise<Result> {
  const m = await member(false);
  if (!m) return { ok: false, message: "Please sign in again." };
  const { data, error } = await m.supabase.from("journal_entries").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn’t delete that entry — try again." };
  revalidatePath("/alignment/journal");
  return { ok: true };
}

// Every entry, to keep somewhere private.
export async function exportJournal(): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const m = await member(false);
  if (!m) return { ok: false, message: "Please sign in again." };
  const { data, error } = await m.supabase.from("journal_entries").select("entry_date, prompt, body, created_at, updated_at").order("entry_date");
  if (error) return { ok: false, message: "Couldn’t export just now — try again." };
  return { ok: true, data: { schema: { name: "aligned.journal", version: 1 }, exported_at: new Date().toISOString(), entries: data ?? [] } };
}
