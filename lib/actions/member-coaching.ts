"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadCoaching } from "@/lib/member-view";

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
  if (!userId) return { available: false, sessions: [], summaries: [], commitments: [], updates: [], drafts: [], shares: [] };
  return loadCoaching(supabase, userId, { drafts: true });
}

// "How's it going?" on an agreed step. Doesn't complete their goal.
export async function reportProgress(input: {
  commitmentId: string;
  progress: "tried" | "partly" | "done" | "not_yet";
  note: string;
  supportRequested: boolean;
}): Promise<{ ok: boolean; message?: string; id?: string }> {
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
  revalidatePath("/");
  return { ok: true, id: data[0].id as string };
}

// A note (and whether they'd like support) on the update they just made with one tap.
export async function addProgressNote(input: { updateId: string; note: string; supportRequested: boolean }): Promise<{ ok: boolean; message?: string }> {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, message: "Please sign in again." };
  const note = input.note.trim().slice(0, 2000) || null;
  if (!note && !input.supportRequested) return { ok: false, message: "Write a note, or tick that you’d like support." };
  const { data, error } = await supabase
    .from("commitment_updates")
    .update({ note, support_requested: input.supportRequested })
    .eq("id", input.updateId)
    .eq("client_id", userId)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn’t save — try again." };
  revalidatePath("/coaching");
  revalidatePath("/");
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

export type GoalCard = { id: string; title: string; area: string | null; now: number | null; target: number | null; main: boolean };

// The member's active goals for the coaching dashboard: each with its area,
// where it is now (last monthly review, else the audit it was planned from)
// and the score they're aiming for. Their own records only.
export async function getMyGoalCards(): Promise<GoalCard[]> {
  const { supabase, userId } = await me();
  if (!userId) return [];
  const { data: goals } = await supabase
    .from("goals")
    .select("id, goal_title, goal_type, clear_plan_id, created_at")
    .eq("client_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (!goals?.length) return [];
  const planIds = goals.map((g) => g.clear_plan_id).filter(Boolean) as string[];
  const [{ data: plans }, { data: checks }, { data: areas }] = await Promise.all([
    planIds.length ? supabase.from("clear_plans").select("id, audit_id, life_area_id, step_up_target").in("id", planIds) : Promise.resolve({ data: [] }),
    supabase.from("goal_checkins").select("goal_id, kind, area_score, created_at").eq("client_id", userId).neq("kind", "weekly").order("created_at", { ascending: false }),
    supabase.from("life_areas").select("id, name"),
  ]);
  const auditIds = [...new Set((plans ?? []).map((p) => p.audit_id).filter(Boolean))] as string[];
  const { data: responses } = auditIds.length
    ? await supabase.from("audit_responses").select("audit_id, life_area_id, satisfaction_score").in("audit_id", auditIds)
    : { data: [] };
  const mainId = (goals.find((g) => g.goal_type === "primary") ?? goals[0]).id;
  return goals.map((g) => {
    const plan = (plans ?? []).find((p) => p.id === g.clear_plan_id) ?? null;
    const last = (checks ?? []).find((c) => c.goal_id === g.id && typeof c.area_score === "number");
    const base = plan ? (responses ?? []).find((r) => r.audit_id === plan.audit_id && r.life_area_id === plan.life_area_id) : null;
    const now = (last?.area_score as number | undefined) ?? (base?.satisfaction_score as number | undefined) ?? null;
    return {
      id: g.id as string,
      title: (g.goal_title as string | null)?.trim() || "Your goal",
      area: (areas ?? []).find((a) => a.id === plan?.life_area_id)?.name ?? null,
      now,
      target: (plan?.step_up_target as number | null | undefined) ?? (now !== null ? Math.min(10, now + 1) : null),
      main: g.id === mainId,
    };
  });
}
