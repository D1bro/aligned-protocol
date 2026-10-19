"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/email";

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
  // The invite link lands on the set-password page, so a new client chooses
  // a password straight away instead of arriving signed in without one.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role: "client" },
    redirectTo: `${SITE_URL}/reset-password/confirm?welcome=1`,
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

export type CoachEnquiry = {
  id: string;
  client_id: string;
  name: string | null;
  email: string | null;
  wants_help: string;
  tried: string | null;
  availability: string | null;
  status: "new" | "contacted" | "booked" | "closed";
  created_at: string;
};

// Coaching enquiries from anyone, newest first. People enquiring may not be
// assigned to this coach yet, so their name and email come via the admin client.
export async function getEnquiries(): Promise<CoachEnquiry[]> {
  await requireCoach();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaching_enquiries")
    .select("id, client_id, wants_help, tried, availability, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data?.length) return [];
  const ids = [...new Set(data.map((e) => e.client_id as string))];
  // Admins can read every profile (migration 0011); otherwise, or for anyone
  // missing, fall back to the server's admin client where it's configured.
  const { data: visible } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  const byId = new Map((visible ?? []).map((p) => [p.id as string, p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    try {
      const { data: rest } = await createAdminClient().from("profiles").select("id, full_name, email").in("id", missing);
      for (const p of rest ?? []) byId.set(p.id as string, p);
    } catch {
      // No service key here (local development): names stay unknown.
    }
  }
  return data.map((e) => ({
    ...(e as Omit<CoachEnquiry, "name" | "email">),
    name: (byId.get(e.client_id as string)?.full_name as string | null) ?? null,
    email: (byId.get(e.client_id as string)?.email as string | null) ?? null,
  }));
}

export async function setEnquiryStatus(id: string, status: CoachEnquiry["status"]): Promise<ActionResult> {
  await requireCoach();
  if (!["new", "contacted", "booked", "closed"].includes(status)) return { ok: false, message: "Unknown status." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("coaching_enquiries").update({ status }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn’t update — try again." };
  revalidatePath("/coach", "layout");
  return { ok: true };
}
