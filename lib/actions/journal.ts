"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canUseDailyAlignment, isAlignmentDate } from "@/lib/alignment";
import { getMyAccess } from "@/lib/actions/membership";
import { checkVideoUrl, ownImages } from "@/lib/journal";

// The private journal (migration 0022): part of Aligned Practice and
// Momentum. Only the writer can read it; coaches and admins can't. After a
// membership ends, entries stay theirs to read and export. Since 0025 an entry
// can link to one of their goals, carry one video link and up to four images
// in their own folder of the private 'journal' bucket. Since 0030 an entry
// is written in one of the ten areas of their chart, or as free writing.

export type JournalEntry = {
  id: string;
  entry_date: string;
  prompt: string | null;
  body: string;
  goal_id: string | null;
  // The life area it's written in; null is free writing (migration 0030).
  life_area_id: string | null;
  video_url: string | null;
  images: string[];
  created_at: string;
  updated_at: string;
  // Short-lived links to show their images (not stored).
  imageUrls?: string[];
};
const COLUMNS = "id, entry_date, prompt, body, goal_id, life_area_id, video_url, images, created_at, updated_at";
type Supabase = Awaited<ReturnType<typeof createClient>>;

// Signed links (an hour) for every image on these entries.
async function withImageUrls(supabase: Supabase, entries: JournalEntry[]): Promise<JournalEntry[]> {
  const paths = entries.flatMap((e) => e.images ?? []);
  if (!paths.length) return entries;
  const { data } = await supabase.storage.from("journal").createSignedUrls(paths, 3600);
  const url = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return entries.map((e) => ({ ...e, imageUrls: (e.images ?? []).map((p) => url.get(p) ?? "").filter(Boolean) }));
}
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

// Newest first, optionally only entries with these words, in one month
// ("YYYY-MM") or in one section ("free", or a life area's id). `available`
// is false before migration 0030 has run.
export async function getJournal(options: { limit?: number; q?: string; month?: string; area?: string } = {}): Promise<{ available: boolean; entries: JournalEntry[] }> {
  const m = await member(false);
  if (!m) return { available: false, entries: [] };
  let query = m.supabase.from("journal_entries").select(COLUMNS);
  const words = options.q?.trim().replace(/[%_,()]/g, " ").trim();
  if (words) query = query.or(`body.ilike.%${words}%,prompt.ilike.%${words}%`);
  if (options.area === "free") query = query.is("life_area_id", null);
  else if (options.area && /^[0-9a-f-]{36}$/i.test(options.area)) query = query.eq("life_area_id", options.area);
  if (options.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(options.month)) {
    const [y, mo] = options.month.split("-").map(Number);
    const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
    query = query.gte("entry_date", `${options.month}-01`).lt("entry_date", next);
  }
  const { data, error } = await query
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 60);
  if (error) return { available: false, entries: [] };
  return { available: true, entries: await withImageUrls(m.supabase, (data ?? []) as JournalEntry[]) };
}

export async function saveJournalEntry(input: {
  id?: string | null;
  entryDate: string;
  prompt: string | null;
  body: string;
  goalId?: string | null;
  lifeAreaId?: string | null;
  videoUrl?: string;
  images?: string[];
}): Promise<Result> {
  const m = await member(true);
  if (!m) return { ok: false, message: "The journal is part of Aligned Practice. Your saved entries are still here to read." };
  const body = input.body.trim();
  if (!body) return { ok: false, message: "Write something first." };
  if (body.length > 20000) return { ok: false, message: "That’s longer than one entry can hold. Split it into two." };
  if (!isAlignmentDate(input.entryDate)) return { ok: false, message: "Choose a date." };
  const video = checkVideoUrl(input.videoUrl ?? "");
  if (!video.ok) return { ok: false, message: video.message };
  const images = ownImages(input.images ?? [], m.userId);
  if (!images) return { ok: false, message: "Up to four of your own images per entry." };
  // Images taken off an entry are deleted from storage once it saves.
  const before = input.id ? await m.supabase.from("journal_entries").select("images").eq("id", input.id).maybeSingle() : null;
  const row = { entry_date: input.entryDate, prompt: input.prompt?.trim().slice(0, 300) || null, body, goal_id: input.goalId || null, life_area_id: input.lifeAreaId || null, video_url: video.value, images };
  const query = input.id
    ? m.supabase.from("journal_entries").update(row).eq("id", input.id)
    : m.supabase.from("journal_entries").insert({ ...row, client_id: m.userId });
  const { data, error } = await query.select(COLUMNS).single();
  if (error || !data) return { ok: false, message: "Couldn’t save — your words are still here. Try again." };
  const removed = ((before?.data?.images as string[] | undefined) ?? []).filter((p) => !images.includes(p));
  if (removed.length) await m.supabase.storage.from("journal").remove(removed);
  revalidatePath("/journal");
  const [entry] = await withImageUrls(m.supabase, [data as JournalEntry]);
  return { ok: true, entry };
}

export async function deleteJournalEntry(id: string): Promise<Result> {
  const m = await member(false);
  if (!m) return { ok: false, message: "Please sign in again." };
  const { data, error } = await m.supabase.from("journal_entries").delete().eq("id", id).select("id, images");
  if (error || !data?.length) return { ok: false, message: "Couldn’t delete that entry — try again." };
  const images = (data[0].images as string[] | null) ?? [];
  if (images.length) await m.supabase.storage.from("journal").remove(images);
  revalidatePath("/journal");
  return { ok: true };
}

// Every entry, to keep somewhere private.
export async function exportJournal(): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const m = await member(false);
  if (!m) return { ok: false, message: "Please sign in again." };
  const { data, error } = await m.supabase.from("journal_entries").select("entry_date, prompt, body, goal_id, life_area_id, video_url, images, created_at, updated_at").order("entry_date");
  if (error) return { ok: false, message: "Couldn’t export just now — try again." };
  return { ok: true, data: { schema: { name: "aligned.journal", version: 3 }, exported_at: new Date().toISOString(), entries: data ?? [] } };
}
