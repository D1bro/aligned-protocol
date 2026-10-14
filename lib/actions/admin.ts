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
  guests: number;
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
