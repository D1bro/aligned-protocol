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

export async function saveClearReflection(
  planId: string,
  fields: Partial<Pick<ClearPlan, "current_reality" | "life_vision" | "emotional_blocks">>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("clear_plans").update(fields).eq("id", planId);
  if (error) throw error;
  revalidatePath("/clear");
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
}): Promise<Goal> {
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
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/goals");
  return data as Goal;
}

export async function updateGoalCore(
  goalId: string,
  fields: { goalTitle: string; actionText: string; motivationText: string }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ goal_title: fields.goalTitle, action_text: fields.actionText, motivation_text: fields.motivationText })
    .eq("id", goalId);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/goals");
}

// Step 5 — Roadmap & Review. Presence of both fields is what marks a goal's
// CLEAR plan as fully finished (see dashboard's clearStatus logic).
export async function saveGoalRoadmap(goalId: string, fields: { frequency: string; successCriteria: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ frequency: fields.frequency, success_criteria: fields.successCriteria })
    .eq("id", goalId);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/goals");
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
