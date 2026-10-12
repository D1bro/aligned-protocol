"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

export type ClearPlan = {
  id: string;
  client_id: string;
  audit_id: string | null;
  life_area_id: string | null;
  current_reality: string | null;
  life_vision: string | null;
  emotional_blocks: string | null;
  step_up_target: number | null;
  step_up_answer: string | null;
};

export type Goal = {
  id: string;
  client_id: string;
  clear_plan_id: string | null;
  goal_title: string;
  goal_type: "primary" | "supporting";
  focus_area: string | null;
  action_text: string | null;
  frequency: string | null;
  success_criteria: string | null;
  motivation_text: string | null;
  start_date: string;
  status: "active" | "completed" | "abandoned";
};

// Read-only lookup — used by the dashboard to show the right CTA state
// ("Begin" vs "Continue" vs "Review") without creating a plan just because
// someone viewed the page.
export async function getClearPlanForAudit(auditId: string): Promise<ClearPlan | null> {
  const clientId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("clear_plans")
    .select("*")
    .eq("audit_id", auditId)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as ClearPlan) ?? null;
}

// One CLEAR plan per audit — resuming /clear always finds (or creates) the
// same row rather than starting a second one, same idempotent pattern as
// startOrResumeAudit for the audit itself. Only called from the /clear page
// itself, deliberately — not from the dashboard, so just glancing at the
// dashboard never silently creates a plan.
export async function getOrCreateClearPlan(auditId: string, lifeAreaId: string): Promise<ClearPlan> {
  const existing = await getClearPlanForAudit(auditId);
  if (existing) return existing;

  const clientId = await requireUserId();
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("clear_plans")
    .insert({ client_id: clientId, audit_id: auditId, life_area_id: lifeAreaId })
    .select("*")
    .single();
  if (error) throw error;
  return created as ClearPlan;
}

// The snapshot's "starting point": which area to work on first and the
// person's answer to "What would a [score + 1] look like?". Stored on the
// CLEAR plan for this audit (created here if needed). Guests can save it too —
// it stays attached when they create their account. Once CLEAR itself has
// begun, the chosen area is fixed; the answer can still be updated.
export async function saveStartingPoint(input: {
  auditId: string;
  lifeAreaId: string;
  target: number;
  answer: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const clientId = await requireUserId();
  const supabase = await createClient();
  const answer = input.answer.trim() ? input.answer.trim().slice(0, 2000) : null;
  const target = Math.max(1, Math.min(10, Math.round(input.target)));
  const existing = await getClearPlanForAudit(input.auditId);

  if (existing) {
    const started = Boolean(existing.current_reality || existing.life_vision || existing.emotional_blocks);
    const { data: updated, error } = await supabase
      .from("clear_plans")
      .update({
        ...(started ? {} : { life_area_id: input.lifeAreaId }),
        step_up_target: target,
        step_up_answer: answer,
      })
      .eq("id", existing.id)
      .select("id");
    if (error || !updated?.length) return { ok: false, message: "Couldn’t save — check your connection and try again." };
  } else {
    const { error } = await supabase.from("clear_plans").insert({
      client_id: clientId,
      audit_id: input.auditId,
      life_area_id: input.lifeAreaId,
      step_up_target: target,
      step_up_answer: answer,
    });
    if (error) return { ok: false, message: "Couldn’t save — check your connection and try again." };
  }
  revalidatePath("/audit/results");
  return { ok: true };
}

// CLEAR saves return a result instead of throwing, so a failed save shows a
// message and keeps what the person typed rather than ending on an error page.
// Each update also checks a row was actually changed: a missing row or a
// refused update returns no error, and must not be reported as "Saved".
export type SaveResult = { ok: true } | { ok: false; message: string };
const SAVE_FAILED = "Couldn’t save — check your connection and try again.";

export async function saveClearReflection(
  planId: string,
  fields: Partial<Pick<ClearPlan, "current_reality" | "life_vision" | "emotional_blocks">>
): Promise<SaveResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clear_plans").update(fields).eq("id", planId).select("id");
  if (error || !data?.length) return { ok: false, message: SAVE_FAILED };
  revalidatePath("/clear");
  return { ok: true };
}

export async function getGoalForPlan(planId: string): Promise<Goal | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("goals").select("*").eq("clear_plan_id", planId).maybeSingle();
  return (data as Goal) ?? null;
}

// Step 4 of CLEAR — the Aligned Goal — creates the actual goals row. This is
// the same table "My Goals" reads from, so finishing CLEAR is what makes a
// goal show up there and on the dashboard, not a separate step.
export async function createGoalFromClear(input: {
  clearPlanId: string;
  focusArea: string;
  goalTitle: string;
  actionText: string;
  motivationText: string;
}): Promise<{ ok: true; goal: Goal } | { ok: false; message: string }> {
  const clientId = await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      client_id: clientId,
      clear_plan_id: input.clearPlanId,
      goal_type: "primary",
      focus_area: input.focusArea,
      goal_title: input.goalTitle,
      action_text: input.actionText,
      motivation_text: input.motivationText,
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: SAVE_FAILED };
  revalidatePath("/");
  revalidatePath("/goals");
  return { ok: true, goal: data as Goal };
}

export async function updateGoalCore(
  goalId: string,
  fields: { goalTitle: string; actionText: string; motivationText: string }
): Promise<SaveResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ goal_title: fields.goalTitle, action_text: fields.actionText, motivation_text: fields.motivationText })
    .eq("id", goalId)
    .select("id");
  if (error || !data?.length) return { ok: false, message: SAVE_FAILED };
  revalidatePath("/");
  revalidatePath("/goals");
  return { ok: true };
}

// Step 5 — Roadmap & Review. Presence of both fields is what marks a goal's
// CLEAR plan as fully finished (see dashboard's clearStatus logic).
export async function saveGoalRoadmap(
  goalId: string,
  fields: { frequency: string; successCriteria: string }
): Promise<SaveResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ frequency: fields.frequency, success_criteria: fields.successCriteria })
    .eq("id", goalId)
    .select("id");
  if (error || !data?.length) return { ok: false, message: SAVE_FAILED };
  revalidatePath("/");
  revalidatePath("/goals");
  return { ok: true };
}

// Close a goal: done, or let go. Without this, every retake's CLEAR added
// another "active" goal and old ones never left the list.
export async function setGoalStatus(goalId: string, status: "completed" | "abandoned"): Promise<SaveResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").update({ status }).eq("id", goalId).select("id");
  if (error || !data?.length) return { ok: false, message: SAVE_FAILED };
  revalidatePath("/");
  revalidatePath("/goals");
  return { ok: true };
}

export async function getActiveGoals(): Promise<Goal[]> {
  const clientId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return (data as Goal[]) ?? [];
}
