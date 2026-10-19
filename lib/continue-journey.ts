// Where someone goes straight after joining (confirming a new profile, or
// signing in with work from a guest audit): into their first plan if they
// have a starting point and the plan isn't finished, otherwise My profile,
// which always leads with their next step. Kept free of server-only imports
// so the rule can be tested directly.
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanProgress = "none" | "chosen" | "in_progress" | "done";

export function nextAfterJoining(p: { hasAudit: boolean; plan: PlanProgress }): string {
  if (!p.hasAudit) return "/";
  if (p.plan === "chosen") return "/clear?welcome=1";
  if (p.plan === "in_progress") return "/clear";
  return "/";
}

const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;

// Reads the person's latest audit and its plan with a signed-in client.
export async function joiningDestination(db: SupabaseClient, userId: string): Promise<string> {
  const { data: audit } = await db
    .from("audits")
    .select("id")
    .eq("client_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!audit) return nextAfterJoining({ hasAudit: false, plan: "none" });
  const { data: plan } = await db.from("clear_plans").select("*").eq("audit_id", audit.id).maybeSingle();
  if (!plan) return nextAfterJoining({ hasAudit: true, plan: "none" });
  const { data: goal } = await db.from("goals").select("frequency, success_criteria").eq("clear_plan_id", plan.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const done = !!goal && filled(goal.frequency) && filled(goal.success_criteria);
  const started = !!goal || filled(plan.current_reality) || filled(plan.life_vision) || filled(plan.emotional_blocks);
  return nextAfterJoining({ hasAudit: true, plan: done ? "done" : started ? "in_progress" : "chosen" });
}
