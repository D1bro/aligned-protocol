"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAlignmentSchemaMissing } from "@/lib/alignment";
import { localDate } from "@/lib/time";
import { monthStart, weekStartOf, type MonthlyIntention, type PlanAction } from "@/lib/planning";

// Connected planning (migration 0023): the monthly intention, today's actions
// and dismissed "What's changed" suggestions. Free for every member. Dates are
// in the business time zone, like the review schedule. `available` is false
// until 0023 has run.

type Result = { ok: true } | { ok: false; message: string };
const failed = (message = "Couldn’t save just now — try again."): Result => ({ ok: false, message });

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && !user.is_anonymous ? { supabase, userId: user.id } : null;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/plan");
}

export async function getMonthIntention(): Promise<{ available: boolean; month: string; intention: MonthlyIntention | null }> {
  const month = monthStart(localDate(new Date()));
  const m = await signedIn();
  if (!m) return { available: false, month, intention: null };
  const { data, error } = await m.supabase
    .from("monthly_intentions")
    .select("id, month, intention, goal_id")
    .eq("client_id", m.userId)
    .eq("month", month)
    .maybeSingle();
  if (error) return { available: false, month, intention: null };
  return { available: true, month, intention: (data as MonthlyIntention | null) ?? null };
}

export async function saveMonthIntention(input: { intention: string; goalId: string | null }): Promise<Result> {
  const m = await signedIn();
  if (!m) return failed();
  const intention = input.intention.trim().slice(0, 300);
  if (!intention) return failed("Write a few words first.");
  const { error } = await m.supabase.from("monthly_intentions").upsert(
    { client_id: m.userId, month: monthStart(localDate(new Date())), intention, goal_id: input.goalId, updated_at: new Date().toISOString() },
    { onConflict: "client_id,month" }
  );
  if (error) return failed(isAlignmentSchemaMissing(error) ? "This isn’t available just yet." : undefined);
  refresh();
  return { ok: true };
}

// This week's actions (Monday to Sunday) and today's date.
export async function getWeekActions(): Promise<{ available: boolean; today: string; weekStart: string; actions: PlanAction[] }> {
  const today = localDate(new Date());
  const weekStart = weekStartOf(today);
  const m = await signedIn();
  if (!m) return { available: false, today, weekStart, actions: [] };
  const end = new Date(Date.parse(`${weekStart}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await m.supabase
    .from("plan_actions")
    .select("*")
    .eq("client_id", m.userId)
    .gte("action_date", weekStart)
    .lt("action_date", end)
    .order("created_at");
  if (error) return { available: false, today, weekStart, actions: [] };
  return { available: true, today, weekStart, actions: (data ?? []) as PlanAction[] };
}

// Tick (or untick) the plan's own action for today.
export async function setPlanActionDone(input: { goalId: string; body: string; done: boolean }): Promise<Result> {
  const m = await signedIn();
  if (!m) return failed();
  const today = localDate(new Date());
  const done_at = input.done ? new Date().toISOString() : null;
  // One tick per goal per day (a partial unique index, so no upsert).
  const { data: existing, error: readError } = await m.supabase
    .from("plan_actions")
    .select("id")
    .eq("client_id", m.userId)
    .eq("goal_id", input.goalId)
    .eq("action_date", today)
    .eq("source", "plan")
    .maybeSingle();
  if (readError) return failed();
  const { error } = existing
    ? await m.supabase.from("plan_actions").update({ done_at }).eq("id", existing.id)
    : await m.supabase.from("plan_actions").insert({
        client_id: m.userId, goal_id: input.goalId, action_date: today, source: "plan", body: input.body.trim().slice(0, 200) || "My plan’s action", done_at,
      });
  if (error) return failed();
  refresh();
  return { ok: true };
}

// An action they add for today, linked to a goal where it fits.
export async function addOwnAction(input: { body: string; goalId: string | null }): Promise<Result> {
  const m = await signedIn();
  if (!m) return failed();
  const body = input.body.trim().slice(0, 200);
  if (!body) return failed("Write the action first.");
  const { error } = await m.supabase.from("plan_actions").insert({ client_id: m.userId, goal_id: input.goalId, action_date: localDate(new Date()), source: "own", body });
  if (error) return failed();
  refresh();
  return { ok: true };
}

export async function setOwnActionDone(id: string, done: boolean): Promise<Result> {
  const m = await signedIn();
  if (!m) return failed();
  const { data, error } = await m.supabase
    .from("plan_actions")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("client_id", m.userId)
    .select("id");
  if (error || !data?.length) return failed();
  refresh();
  return { ok: true };
}

export async function removeOwnAction(id: string): Promise<Result> {
  const m = await signedIn();
  if (!m) return failed();
  const { error } = await m.supabase.from("plan_actions").delete().eq("id", id).eq("client_id", m.userId).eq("source", "own");
  if (error) return failed();
  refresh();
  return { ok: true };
}

export async function isSuggestionDismissed(auditId: string): Promise<boolean> {
  const m = await signedIn();
  if (!m) return true;
  const { data, error } = await m.supabase.from("plan_suggestion_dismissals").select("audit_id").eq("client_id", m.userId).eq("audit_id", auditId).maybeSingle();
  // Before 0023 has run, there's nowhere to remember a dismissal: don't show it.
  return error ? true : !!data;
}

export async function dismissSuggestions(auditId: string): Promise<Result> {
  const m = await signedIn();
  if (!m) return failed();
  const { error } = await m.supabase.from("plan_suggestion_dismissals").upsert({ client_id: m.userId, audit_id: auditId }, { onConflict: "client_id,audit_id" });
  if (error) return failed();
  refresh();
  return { ok: true };
}
