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

type GuestAudit = {
  audit: Record<string, unknown>;
  responses: Record<string, unknown>[];
  plan: Record<string, unknown> | null;
};

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
    const { data: plan } = await supabase
      .from("clear_plans")
      .select("*")
      .eq("audit_id", audit.id)
      .eq("client_id", guestId)
      .maybeSingle();
    work.push({ audit, responses, plan: plan ?? null });
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

  for (const { audit, responses, plan } of work) {
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

    if (plan) {
      const { error: planErr } = await supabase.from("clear_plans").insert({
        client_id: userId,
        audit_id: copy.id,
        life_area_id: plan.life_area_id,
        current_reality: plan.current_reality,
        life_vision: plan.life_vision,
        emotional_blocks: plan.emotional_blocks,
        step_up_target: plan.step_up_target,
        step_up_answer: plan.step_up_answer,
      });
      if (planErr) throw planErr;
    }
  }
}
