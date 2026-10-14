"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveGoals, type ClearPlan, type Goal } from "@/lib/actions/clear";
import { getLifeAreas, type LifeArea } from "@/lib/actions/audit";
import { getCheckIns, type CheckIn } from "@/lib/actions/checkins";

// The member's main goal: the one My profile and My plan both show.
// Other active goals are kept as they are; the member chooses which is main.
// goals.goal_type marks it — 'primary' for the main goal, 'supporting' for
// the rest. Until someone chooses, the newest active 'primary' goal is main
// (a goal set through CLEAR starts as 'primary').
export type MainGoal = {
  goal: Goal;
  plan: ClearPlan | null;
  area: LifeArea | null;
  // The area's score in the audit this goal was planned from (self-reported).
  baselineScore: number | null;
  baselineDate: string | null;
  baselineNote: string | null;
  responses: { life_area_id: string; satisfaction_score: number }[];
  target: number | null;
  checkIns: CheckIn[];
  otherActive: Goal[];
};

export async function getMainGoal(): Promise<MainGoal | null> {
  const active = await getActiveGoals();
  if (!active.length) return null;
  const goal = active.find((g) => g.goal_type === "primary") ?? active[0];
  const otherActive = active.filter((g) => g.id !== goal.id);

  const supabase = await createClient();
  const [{ data: plan }, areas, checkIns] = await Promise.all([
    goal.clear_plan_id
      ? supabase.from("clear_plans").select("*").eq("id", goal.clear_plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getLifeAreas(),
    getCheckIns(goal.id),
  ]);
  const p = (plan as ClearPlan | null) ?? null;
  const area =
    areas.find((a) => a.id === p?.life_area_id) ?? areas.find((a) => a.name === goal.focus_area?.trim()) ?? null;

  let baselineScore: number | null = null;
  let baselineDate: string | null = null;
  let baselineNote: string | null = null;
  let responses: MainGoal["responses"] = [];
  if (p?.audit_id) {
    const [{ data: audit }, { data: rs }] = await Promise.all([
      supabase.from("audits").select("completed_at").eq("id", p.audit_id).maybeSingle(),
      supabase.from("audit_responses").select("life_area_id, satisfaction_score, note").eq("audit_id", p.audit_id),
    ]);
    baselineDate = (audit?.completed_at as string | null) ?? null;
    responses = (rs ?? []) as MainGoal["responses"];
    const mine = (rs ?? []).find((r) => r.life_area_id === area?.id);
    baselineScore = (mine?.satisfaction_score as number | undefined) ?? null;
    baselineNote = ((mine?.note as string | null | undefined) ?? "").trim() || null;
  }
  const target = p?.step_up_target ?? (baselineScore !== null ? Math.min(10, baselineScore + 1) : null);

  return { goal, plan: p, area, baselineScore, baselineDate, baselineNote, responses, target, checkIns, otherActive };
}

// Make one active goal the main goal. Only changes which goal is main — never
// a goal's status or wording.
export async function setMainGoal(goalId: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { data: chosen, error } = await supabase
    .from("goals")
    .update({ goal_type: "primary" })
    .eq("id", goalId)
    .eq("client_id", user.id)
    .eq("status", "active")
    .select("id");
  if (error || !chosen?.length) return { ok: false, message: "Couldn’t change your main goal — try again." };

  const { error: othersError } = await supabase
    .from("goals")
    .update({ goal_type: "supporting" })
    .eq("client_id", user.id)
    .eq("status", "active")
    .neq("id", goalId);
  if (othersError) return { ok: false, message: "Couldn’t change your main goal — try again." };

  revalidatePath("/");
  revalidatePath("/clear");
  return { ok: true };
}
