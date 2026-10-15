"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// The admin console (/coach with an admin account). Reads go through the
// database functions in migration 0011, which check the caller is an admin
// (or, for the client list, a coach seeing their own clients).

export type StaffRole = "coach" | "admin";

export async function requireStaff(): Promise<{ id: string; role: StaffRole; full_name: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("id, role, full_name").eq("id", user.id).single();
  if (!data || (data.role !== "coach" && data.role !== "admin")) redirect("/");
  return data as { id: string; role: StaffRole; full_name: string | null };
}

export async function requireAdmin() {
  const me = await requireStaff();
  if (me.role !== "admin") redirect("/coach/clients");
  return me;
}

export type Metrics = {
  members: number;
  members_30d: number;
  // Guests who started (answered at least one question) / finished the audit.
  guests: number;
  guests_finished?: number;
  // Guest sign-ins with nothing started (older visits, crawlers, previews).
  guest_signins_empty?: number;
  audits: number;
  audits_30d: number;
  people_audited: number;
  members_audited: number;
  plans_set: number;
  first_action: number;
  checkins: number;
  checkins_30d: number;
  goals_done: number;
  lessons_done: number;
  people_learning: number;
  came_back: number;
  active_30d: number;
  enquiries: number;
  enquiries_new: number;
  enquiries_booked: number;
};

// null when the console's database functions aren't installed yet.
export async function getMetrics(): Promise<Metrics | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_metrics");
  if (error) return null;
  return data as Metrics;
}

export type ClientSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  coach_id: string | null;
  coach_name: string | null;
  audits: number;
  last_audit_at: string | null;
  last_audit_score: number | null;
  main_goal: string | null;
  main_goal_area: string | null;
  plan_set: boolean;
  active_goals: number;
  goals_done: number;
  checkins: number;
  last_checkin_at: string | null;
  lessons_done: number;
  last_active_at: string | null;
  enquiry_status: string | null;
};

export async function getClientSummaries(): Promise<ClientSummary[] | null> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_client_list");
  if (error) return null;
  return (data ?? []) as ClientSummary[];
}

export type StaffMember = { id: string; full_name: string | null; email: string | null; role: StaffRole };

export async function getStaff(): Promise<StaffMember[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["coach", "admin"])
    .order("full_name");
  return (data ?? []) as StaffMember[];
}

export async function setRole(userId: string, role: "client" | "coach" | "admin"): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", { p_user: userId, p_role: role });
  if (error) return { ok: false, message: error.message || "Couldn’t change the role — try again." };
  revalidatePath("/coach", "layout");
  return { ok: true };
}

export async function assignCoach(clientId: string, coachId: string | null): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_coach", { p_client: clientId, p_coach: coachId });
  if (error) return { ok: false, message: error.message || "Couldn’t assign the coach — try again." };
  revalidatePath("/coach", "layout");
  return { ok: true };
}

export type ReminderStatus = { configured: boolean; lastSent: string | null; sentTotal: number };

export async function getReminderStatus(): Promise<ReminderStatus> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("reminder_log")
    .select("sent_at", { count: "exact" })
    .order("sent_at", { ascending: false })
    .limit(1);
  return {
    configured: Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM && process.env.CRON_SECRET),
    lastSent: (data?.[0]?.sent_at as string | undefined) ?? null,
    sentTotal: count ?? 0,
  };
}

// Everything for one client's profile in the console. Admins can open anyone;
// a coach only their own clients. Private reflections and tool answers are
// never returned (the database refuses them).
export async function getClientProfile(clientId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name, email, coach_id, role, created_at")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || (me.role !== "admin" && client.coach_id !== me.id)) redirect("/coach/clients");
  // Their own words, if they've written an identity statement (migration 0008).
  const { data: identity } = await supabase.from("profiles").select("identity_statement").eq("id", clientId).maybeSingle();

  const [audits, plans, goals, checkIns, notes, reflections, enquiries, coach, summaries] = await Promise.all([
    supabase
      .from("audits")
      .select("id, completed_at, total_score, sequence_number")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false }),
    supabase.from("clear_plans").select("*").eq("client_id", clientId),
    supabase.from("goals").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("goal_checkins").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("session_notes").select("*").eq("client_id", clientId).order("session_date", { ascending: false }),
    supabase
      .from("lesson_progress")
      .select("lesson_slug, reflection, completed_at, updated_at")
      .eq("client_id", clientId)
      .eq("private", false),
    supabase.from("coaching_enquiries").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    client.coach_id
      ? supabase.from("profiles").select("full_name, email").eq("id", client.coach_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getClientSummaries(),
  ]);

  // Coaching records (migration 0013). Private notes and transcripts are only
  // returned by the database to the assigned coach or the note's author.
  const [sessions, sessionEvents, sessionSummaries, commitments, updates, prepShares, relationship, coachNotes] = await Promise.all([
    supabase.from("coaching_sessions").select("*").eq("client_id", clientId).order("scheduled_at", { ascending: false }),
    supabase.from("coaching_session_events").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("session_summaries").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("session_commitments").select("*").eq("client_id", clientId).order("created_at", { ascending: true }),
    supabase.from("commitment_updates").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("prep_shares").select("*").eq("client_id", clientId).order("shared_at", { ascending: false }),
    supabase.from("coaching_relationships").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("coach_notes").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }),
  ]);

  const auditIds = (audits.data ?? []).map((a) => a.id as string);
  const { data: responses } = auditIds.length
    ? await supabase.from("audit_responses").select("audit_id, life_area_id, satisfaction_score, note").in("audit_id", auditIds)
    : { data: [] };

  return {
    viewer: me,
    client: client as { id: string; full_name: string | null; email: string | null; coach_id: string | null; role: "client" | "coach" | "admin"; created_at: string },
    coachName: (coach.data?.full_name as string | null) ?? (coach.data?.email as string | null) ?? null,
    audits: (audits.data ?? []) as { id: string; completed_at: string; total_score: number | null; sequence_number: number }[],
    responses: (responses ?? []) as { audit_id: string; life_area_id: string; satisfaction_score: number; note: string | null }[],
    plans: (plans.data ?? []) as Record<string, unknown>[],
    goals: (goals.data ?? []) as Record<string, unknown>[],
    checkIns: (checkIns.data ?? []) as Record<string, unknown>[],
    notes: (notes.data ?? []) as Record<string, unknown>[],
    reflections: (reflections.data ?? []) as { lesson_slug: string; reflection: string | null; completed_at: string | null; updated_at: string }[],
    enquiries: (enquiries.data ?? []) as Record<string, unknown>[],
    summary: summaries?.find((s) => s.id === clientId) ?? null,
    identityStatement: ((identity?.identity_statement as string | null | undefined) ?? "").trim() || null,
    coaching: {
      available: !sessions.error,
      sessions: (sessions.data ?? []) as import("@/lib/actions/sessions").CoachingSession[],
      events: (sessionEvents.data ?? []) as import("@/lib/actions/sessions").SessionEvent[],
      summaries: (sessionSummaries.data ?? []) as Record<string, unknown>[],
      commitments: (commitments.data ?? []) as Record<string, unknown>[],
      updates: (updates.data ?? []) as Record<string, unknown>[],
      prepShares: (prepShares.data ?? []) as Record<string, unknown>[],
      relationship: (relationship.data as { status: string; started_on: string | null } | null) ?? null,
      notes: (coachNotes.data ?? []) as import("@/lib/actions/sessions").CoachNote[],
    },
  };
}

// Admin: email someone a password reset link (goes through Supabase's email
// settings — set up custom SMTP so it actually arrives).
export async function sendPasswordReset(clientId: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("email").eq("id", clientId).maybeSingle();
  const email = data?.email as string | undefined;
  if (!email) return { ok: false, message: "This person has no email address yet." };
  const { SITE_URL } = await import("@/lib/email");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/reset-password/confirm` });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `Reset link sent to ${email}.` };
}
