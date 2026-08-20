"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LifeArea = {
  id: string;
  sort_order: number;
  name: string;
  icon: string | null;
  description: string;
  hint: string | null;
};

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function getLifeAreas(): Promise<LifeArea[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("life_areas").select("*").order("sort_order");
  if (error) throw error;
  return data as LifeArea[];
}

// Finds an in-progress audit or starts a new one (next sequence_number).
// Idempotent to call repeatedly — landing on /audit never creates a stray row
// if one is already open.
export async function startOrResumeAudit(): Promise<string> {
  const clientId = await requireUserId();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("audits")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: last } = await supabase
    .from("audits")
    .select("sequence_number")
    .eq("client_id", clientId)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSeq = (last?.sequence_number ?? 0) + 1;

  const { data: created, error } = await supabase
    .from("audits")
    .insert({ client_id: clientId, sequence_number: nextSeq })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

export async function getAuditWithResponses(auditId: string) {
  const supabase = await createClient();
  const { data: audit, error } = await supabase.from("audits").select("*").eq("id", auditId).single();
  if (error) throw error;
  const { data: responses } = await supabase
    .from("audit_responses")
    .select("*")
    .eq("audit_id", auditId);
  return { audit, responses: responses ?? [] };
}

export async function saveResponse(input: {
  auditId: string;
  lifeAreaId: string;
  satisfaction: number;
  importance: number;
  note?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("audit_responses").upsert(
    {
      audit_id: input.auditId,
      life_area_id: input.lifeAreaId,
      satisfaction_score: input.satisfaction,
      importance_score: input.importance,
      note: input.note || null,
    },
    { onConflict: "audit_id,life_area_id" }
  );
  if (error) throw error;
  revalidatePath("/audit");
}

export async function setFocusArea(auditId: string, lifeAreaId: string, lifeAreaName: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("audits")
    .update({ focus_area_id: lifeAreaId, focus_area: lifeAreaName })
    .eq("id", auditId);
  if (error) throw error;
}

// Sum of the ten satisfaction scores -> total_score out of 100. Marks the
// audit completed, which the DB then refuses to let anyone edit further.
export async function completeAudit(auditId: string) {
  const supabase = await createClient();
  const { data: responses, error: respErr } = await supabase
    .from("audit_responses")
    .select("satisfaction_score")
    .eq("audit_id", auditId);
  if (respErr) throw respErr;

  const total = (responses ?? []).reduce((sum, r) => sum + (r.satisfaction_score ?? 0), 0);

  const { error } = await supabase
    .from("audits")
    .update({ status: "completed", total_score: total, completed_at: new Date().toISOString() })
    .eq("id", auditId);
  if (error) throw error;

  redirect("/audit/results");
}

export async function getLatestCompletedAudit() {
  const clientId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("audits")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// Latest first. Used to show a "+8 vs last audit" style delta on the
// dashboard — recent[0] is the current audit, recent[1] the one before it.
export async function getRecentCompletedAudits(limit = 2) {
  const clientId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("audits")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
