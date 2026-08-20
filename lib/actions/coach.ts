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
    .select("client_id, total_score, focus_area, completed_at")
    .in("client_id", ids)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  // audits is already sorted newest-first, so the first row we see per
  // client is that client's latest completed audit.
  const latestByClient = new Map<string, { total_score: number | null; focus_area: string | null; completed_at: string }>();
  for (const a of audits ?? []) {
    if (!latestByClient.has(a.client_id)) latestByClient.set(a.client_id, a);
  }

  return clients.map((c) => {
    const latest = latestByClient.get(c.id);
    return {
      id: c.id,
      full_name: c.full_name,
      email: c.email,
      latestScore: latest?.total_score ?? null,
      focusArea: latest?.focus_area ?? null,
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

  return { client, audits: audits ?? [], goals: goals ?? [], notes: notes ?? [] };
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
