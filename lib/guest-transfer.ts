import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Carries a guest's audit work into the account they sign in to.
//
// Creating a NEW account converts the guest identity in place (see signUp),
// so nothing needs moving. Signing in to an EXISTING account switches
// identity instead, which would leave the guest's snapshot behind. So:
// read the guest's data while still signed in as the guest, sign in, then
// save copies under the real account — all through the normal per-user
// security rules, no service key needed. Completed audits are locked by the
// database, which is why this copies rather than re-assigns. The old guest
// rows stay with the (now abandoned) guest identity, invisible to everyone,
// exactly like any guest who never signs up.

type Row = Record<string, unknown>;
type GuestAudit = {
  audit: Row;
  responses: Row[];
  // A plan per area they started a Next Step in, with its goals (the Next
  // Steps a guest set before saving) and each goal's moves.
  plans: { plan: Row; goals: { goal: Row; moves: Row[] }[] }[];
};

// The plan's own answers, copied as they are. Columns from later migrations
// are only present once those have run; a missing one is simply left out.
const PLAN_FIELDS = [
  "life_area_id", "current_reality", "life_vision", "emotional_blocks", "step_up_target", "step_up_answer",
  "blocks", "block_answers", "tried_before", "if_obstacle", "if_response", "why_it_matters",
];
const GOAL_FIELDS = [
  "goal_title", "goal_type", "focus_area", "action_text", "frequency", "action_when", "success_criteria",
  "motivation_text", "start_date", "status", "created_at",
  // The Next Step (migration 0029)
  "start_score", "aim_score", "feel_text", "in_the_way", "spill_over", "step_checks", "set_at",
];
const MOVE_FIELDS = ["position", "body", "when_text", "due_date", "done_at", "created_at"];
const pick = (row: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));

export async function readGuestWork(supabase: SupabaseClient, guestId: string): Promise<GuestAudit[]> {
  const { data: audits } = await supabase
    .from("audits")
    .select("*")
    .eq("client_id", guestId)
    .order("created_at", { ascending: true });

  const work: GuestAudit[] = [];
  for (const audit of audits ?? []) {
    const { data: responses } = await supabase.from("audit_responses").select("*").eq("audit_id", audit.id);
    if (!responses?.length) continue; // opened the audit but never answered anything
    const { data: planRows } = await supabase
      .from("clear_plans")
      .select("*")
      .eq("audit_id", audit.id)
      .eq("client_id", guestId)
      .order("created_at", { ascending: true });
    const plans: GuestAudit["plans"] = [];
    for (const plan of planRows ?? []) {
      const { data: goals } = await supabase.from("goals").select("*").eq("clear_plan_id", plan.id).eq("client_id", guestId);
      const withMoves = [];
      for (const goal of goals ?? []) {
        const { data: moves } = await supabase.from("goal_moves").select("*").eq("goal_id", goal.id);
        withMoves.push({ goal, moves: moves ?? [] });
      }
      plans.push({ plan, goals: withMoves });
    }
    work.push({ audit, responses, plans });
  }
  return work;
}

// Run after signing in, with the same client (now the real user's session).
export async function saveGuestWorkToAccount(supabase: SupabaseClient, userId: string, work: GuestAudit[]) {
  if (!work.length) return;

  const { data: last } = await supabase
    .from("audits")
    .select("sequence_number")
    .eq("client_id", userId)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let seq = (last?.sequence_number as number | undefined) ?? 0;

  for (const { audit, responses, plans } of work) {
    seq += 1;
    const { data: copy, error } = await supabase
      .from("audits")
      .insert({
        client_id: userId,
        sequence_number: seq,
        status: audit.status,
        focus_area_id: audit.focus_area_id,
        focus_area: audit.focus_area,
        total_score: audit.total_score,
        completed_at: audit.completed_at,
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: respErr } = await supabase.from("audit_responses").insert(
      responses.map((r) => ({
        audit_id: copy.id,
        life_area_id: r.life_area_id,
        satisfaction_score: r.satisfaction_score,
        importance_score: r.importance_score,
        note: r.note,
      }))
    );
    if (respErr) throw respErr;

    for (const { plan, goals } of plans) {
      const { data: planCopy, error: planErr } = await supabase
        .from("clear_plans")
        .insert({ client_id: userId, audit_id: copy.id, ...pick(plan, PLAN_FIELDS) })
        .select("id")
        .single();
      if (planErr) throw planErr;
      for (const { goal, moves } of goals) {
        const { data: goalCopy, error: goalErr } = await supabase
          .from("goals")
          .insert({ client_id: userId, clear_plan_id: planCopy.id, ...pick(goal, GOAL_FIELDS) })
          .select("id")
          .single();
        if (goalErr) throw goalErr;
        if (moves.length) {
          const { error: moveErr } = await supabase
            .from("goal_moves")
            .insert(moves.map((m) => ({ client_id: userId, goal_id: goalCopy.id, ...pick(m, MOVE_FIELDS) })));
          if (moveErr) throw moveErr;
        }
      }
    }
  }
}
