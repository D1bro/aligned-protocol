"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

async function requireCoach() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) redirect("/");
  return profile;
}

// The area each audit is being worked on: the starting point saved on its
// CLEAR plan, or (for audits taken before that change) the old focus answer.
async function startingAreaByAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  auditIds: string[]
): Promise<Map<string, string>> {
  if (!auditIds.length) return new Map();
  const [{ data: plans }, { data: areas }] = await Promise.all([
    supabase.from("clear_plans").select("audit_id, life_area_id").in("audit_id", auditIds),
    supabase.from("life_areas").select("id, name"),
  ]);
  const nameById = new Map((areas ?? []).map((a) => [a.id as string, a.name as string]));
  const result = new Map<string, string>();
  for (const p of plans ?? []) {
    const name = p.life_area_id ? nameById.get(p.life_area_id) : undefined;
    if (p.audit_id && name) result.set(p.audit_id, name);
  }
  return result;
}

export type ClientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  latestScore: number | null;
  focusArea: string | null;
  lastAuditDate: string | null;
};

export async function getMyClients(): Promise<ClientRow[]> {
  const coach = await requireCoach();
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("coach_id", coach.id)
    .order("full_name");

  if (!clients || clients.length === 0) return [];

  const ids = clients.map((c) => c.id);
  const { data: audits } = await supabase
    .from("audits")
    .select("id, client_id, total_score, focus_area, completed_at")
    .in("client_id", ids)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  // audits is already sorted newest-first, so the first row we see per
  // client is that client's latest completed audit.
  const latestByClient = new Map<string, { id: string; total_score: number | null; focus_area: string | null; completed_at: string }>();
  for (const a of audits ?? []) {
    if (!latestByClient.has(a.client_id)) latestByClient.set(a.client_id, a);
  }

  const starting = await startingAreaByAudit(supabase, [...latestByClient.values()].map((a) => a.id));

  return clients.map((c) => {
    const latest = latestByClient.get(c.id);
    return {
      id: c.id,
      full_name: c.full_name,
      email: c.email,
      latestScore: latest?.total_score ?? null,
      focusArea: (latest && starting.get(latest.id)) ?? latest?.focus_area ?? null,
      lastAuditDate: latest?.completed_at ?? null,
    };
  });
}

export async function getClientDetail(clientId: string) {
  const coach = await requireCoach();
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name, email, coach_id")
    .eq("id", clientId)
    .single();

  // RLS already scopes a coach's profile reads to coach_id = auth.uid(), so
  // a client that isn't yours would come back null from the query above
  // regardless — this check just makes the intent explicit and gives a
  // clean redirect instead of a confusing blank page.
  if (!client || client.coach_id !== coach.id) redirect("/coach");

  const [{ data: audits }, { data: goals }, { data: notes }] = await Promise.all([
    supabase
      .from("audits")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false }),
    supabase
      .from("goals")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("session_notes")
      .select("*")
      .eq("client_id", clientId)
      .order("session_date", { ascending: false }),
  ]);

  const latestAudit = audits?.[0];
  const starting = latestAudit ? await startingAreaByAudit(supabase, [latestAudit.id]) : new Map<string, string>();
  const startingArea: string | null = (latestAudit && starting.get(latestAudit.id)) ?? latestAudit?.focus_area ?? null;

  // The full picture for the latest audit: every answer and note, the CLEAR
  // plan, its current goal and the check-ins on it (all readable by the
  // assigned coach under the existing access rules).
  let latestDetail: {
    responses: { life_area_id: string; satisfaction_score: number; note: string | null }[];
    plan: Record<string, unknown> | null;
    goal: Record<string, unknown> | null;
    checkIns: { id: string; did_it: string; area_score: number; helped: string | null; got_in_way: string | null; next_step: string; created_at: string }[];
  } | null = null;
  if (latestAudit) {
    const [{ data: responses }, { data: plan }] = await Promise.all([
      supabase.from("audit_responses").select("life_area_id, satisfaction_score, note").eq("audit_id", latestAudit.id),
      supabase.from("clear_plans").select("*").eq("audit_id", latestAudit.id).maybeSingle(),
    ]);
    const { data: goal } = plan
      ? await supabase.from("goals").select("*").eq("clear_plan_id", plan.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    const { data: checkIns } = goal
      ? await supabase.from("goal_checkins").select("*").eq("goal_id", goal.id).order("created_at", { ascending: false })
      : { data: null };
    latestDetail = { responses: responses ?? [], plan: plan ?? null, goal: goal ?? null, checkIns: checkIns ?? [] };
  }

  return { client, audits: audits ?? [], goals: goals ?? [], notes: notes ?? [], startingArea, latestDetail };
}

export async function addSessionNote(input: {
  clientId: string;
  sessionDate: string;
  focus: string;
  note: string;
  nextActions: string;
  clientMood: number | null;
}): Promise<ActionResult> {
  const coach = await requireCoach();
  if (!input.note.trim()) return { ok: false, message: "Add a note before saving." };

  const supabase = await createClient();
  const { error } = await supabase.from("session_notes").insert({
    client_id: input.clientId,
    coach_id: coach.id,
    session_date: input.sessionDate,
    focus: input.focus || null,
    note: input.note,
    next_actions: input.nextActions || null,
    client_mood: input.clientMood,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/coach/clients/${input.clientId}`);
  return { ok: true };
}

// THE fix for the original security bug: the old coach.html called
// supabase.auth.signUp() straight from the coach's own browser tab, which
// replaces whatever session is active — silently signing the coach out and
// signing them in AS the new client. This runs server-side through the
// service-role admin client instead, so the coach's own session is never
// touched. The new client gets an email invite to set their own password.
export async function addClient(formData: FormData): Promise<ActionResult> {
  const coach = await requireCoach();

  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  if (!fullName || !email) return { ok: false, message: "Enter a name and email." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role: "client" },
  });
  if (error) return { ok: false, message: error.message };

  // handle_new_user already created the profiles row (role: client,
  // full_name, email) the instant the auth user was created — this just
  // links it to you. Also done through the admin client: a coach's regular
  // session can only update their OWN profile row under RLS, not a new
  // client's.
  const { error: linkError } = await admin
    .from("profiles")
    .update({ coach_id: coach.id })
    .eq("id", data.user.id);
  if (linkError) return { ok: false, message: linkError.message };

  revalidatePath("/coach");
  return { ok: true, message: `Invite sent to ${email}.` };
}
