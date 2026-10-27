// Where someone goes straight after joining (confirming a new profile, or
// signing in with work from a guest audit): into their first plan if they
// have a starting point and the plan isn't finished; My profile with a
// "your plan is saved" welcome if they built it as a guest; otherwise My
// profile, which always leads with their next step. Kept free of server-only imports
// so the rule can be tested directly.
import type { SupabaseClient } from "@supabase/supabase-js";
import { planStarted } from "./plan-action.ts";

export type PlanProgress = "none" | "chosen" | "in_progress" | "done";

export function nextAfterJoining(p: { hasAudit: boolean; plan: PlanProgress }): string {
  if (!p.hasAudit) return "/";
  // ?latest=1: the plan for this newest audit, even if an older goal is
  // still their main one.
  if (p.plan === "chosen" || p.plan === "in_progress") return "/clear?latest=1";
  if (p.plan === "done") return "/?welcome=plan";
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
  const started = !!goal || planStarted(plan);
  return nextAfterJoining({ hasAudit: true, plan: done ? "done" : started ? "in_progress" : "chosen" });
}
