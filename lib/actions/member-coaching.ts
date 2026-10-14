"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// The member's side of coaching: their sessions, the summaries their coach
// has shared, the steps agreed, their progress updates and preparation.
// Everything is read through the database's member rules (own records,
// published summaries only, commitments meant for them).

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

export type MemberCoaching = {
  available: boolean;
  sessions: { id: string; scheduled_at: string; timezone: string; duration_minutes: number; state: string; location: string | null }[];
  summaries: { id: string; session_id: string; revision: number; content: Record<string, unknown>; published_at: string }[];
  commitments: { id: string; summary_id: string; session_id: string; owner: string; body: string; due_date: string | null; status: string; goal_id: string | null }[];
  updates: { id: string; commitment_id: string; progress: string; note: string | null; support_requested: boolean; created_at: string }[];
  drafts: { id: string; session_id: string | null; content: string; updated_at: string }[];
  shares: { id: string; session_id: string | null; content: string; shared_at: string }[];
};

export async function getMyCoaching(): Promise<MemberCoaching> {
  const { supabase, userId } = await me();
  const empty: MemberCoaching = { available: false, sessions: [], summaries: [], commitments: [], updates: [], drafts: [], shares: [] };
  if (!userId) return empty;
  const [sessions, summaries, commitments, updates, drafts, shares] = await Promise.all([
    supabase.from("coaching_sessions").select("id, scheduled_at, timezone, duration_minutes, state, location").eq("client_id", userId).order("scheduled_at", { ascending: false }),
    supabase.from("session_summaries").select("id, session_id, revision, content, published_at").eq("client_id", userId).eq("status", "published").order("published_at", { ascending: false }),
    supabase.from("session_commitments").select("id, summary_id, session_id, owner, body, due_date, status, goal_id").eq("client_id", userId).order("position"),
    supabase.from("commitment_updates").select("id, commitment_id, progress, note, support_requested, created_at").eq("client_id", userId).order("created_at", { ascending: false }),
    supabase.from("prep_drafts").select("id, session_id, content, updated_at").eq("client_id", userId),
    supabase.from("prep_shares").select("id, session_id, content, shared_at").eq("client_id", userId).order("shared_at", { ascending: false }),
  ]);
  if (sessions.error) return empty;
  return {
    available: true,
    sessions: (sessions.data ?? []) as MemberCoaching["sessions"],
    summaries: (summaries.data ?? []) as MemberCoaching["summaries"],
    commitments: (commitments.data ?? []) as MemberCoaching["commitments"],
    updates: (updates.data ?? []) as MemberCoaching["updates"],
    drafts: (drafts.data ?? []) as MemberCoaching["drafts"],
    shares: (shares.data ?? []) as MemberCoaching["shares"],
  };
}

// "How's it going?" on an agreed step. Doesn't complete their goal.
export async function reportProgress(input: {
  commitmentId: string;
  progress: "tried" | "partly" | "done" | "not_yet";
  note: string;
  supportRequested: boolean;
}): Promise<{ ok: boolean; message?: string }> {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, message: "Please sign in again." };
  if (!["tried", "partly", "done", "not_yet"].includes(input.progress)) return { ok: false, message: "Choose how it went." };
  const { data, error } = await supabase
    .from("commitment_updates")
    .insert({
      commitment_id: input.commitmentId,
      client_id: userId,
      author_id: userId,
      progress: input.progress,
      note: input.note.trim().slice(0, 2000) || null,
      support_requested: input.supportRequested,
    })
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn’t save — try again." };
  revalidatePath("/coaching");
  return { ok: true };
}

// Preparation: saved privately until they choose to share it.
export async function savePrepDraft(input: { sessionId: string | null; content: string }): Promise<{ ok: boolean; message?: string }> {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, message: "Please sign in again." };
  const content = input.content.slice(0, 10_000);
  let q = supabase.from("prep_drafts").select("id").eq("client_id", userId);
  q = input.sessionId ? q.eq("session_id", input.sessionId) : q.is("session_id", null);
  const { data: existing } = await q.maybeSingle();
  const { data, error } = existing
    ? await supabase.from("prep_drafts").update({ content, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id")
    : await supabase.from("prep_drafts").insert({ client_id: userId, session_id: input.sessionId, content }).select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn’t save — your text is still here. Try again." };
  return { ok: true };
}

export async function sharePrep(input: { sessionId: string | null; content: string }): Promise<{ ok: boolean; message?: string }> {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, message: "Please sign in again." };
  const content = input.content.trim().slice(0, 10_000);
  if (!content) return { ok: false, message: "Write something to share first." };
  await savePrepDraft(input);
  const { data, error } = await supabase.from("prep_shares").insert({ client_id: userId, session_id: input.sessionId, content }).select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn’t share — try again." };
  revalidatePath("/coaching");
  return { ok: true };
}
