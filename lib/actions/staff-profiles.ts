"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/actions/admin";
import { env } from "@/lib/env";

// Coach basics and client admin (migration 0027). Name, phone and time zone
// live on profiles; the rest in coach_public, client_records and
// client_admin_notes. `available` is false until 0027 has run.

type Result = { ok: true } | { ok: false; message: string };
export type CoachBasics = {
  available: boolean;
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  timezone: string;
  photoUrl: string | null;
  photoPath: string | null;
  bio: string;
  credentials: string;
  meetingLink: string;
  defaultMinutes: number;
};

const photoUrl = (path: string | null | undefined) => (path ? `${env.supabaseUrl}/storage/v1/object/public/coach-photos/${path}` : null);
const validZone = (z: string) => {
  if (!z) return true;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: z });
    return true;
  } catch {
    return false;
  }
};

async function basicsFor(id: string): Promise<CoachBasics> {
  const supabase = await createClient();
  const [{ data: p }, { data: c, error }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone, timezone").eq("id", id).maybeSingle(),
    supabase.from("coach_public").select("photo_path, bio, credentials, meeting_link, default_minutes").eq("coach_id", id).maybeSingle(),
  ]);
  return {
    available: !error,
    id,
    fullName: (p?.full_name as string | null) ?? "",
    email: (p?.email as string | null) ?? null,
    phone: (p?.phone as string | null) ?? "",
    timezone: (p?.timezone as string | null) ?? "",
    photoPath: (c?.photo_path as string | null) ?? null,
    photoUrl: photoUrl(c?.photo_path as string | null),
    bio: (c?.bio as string | undefined) ?? "",
    credentials: (c?.credentials as string | undefined) ?? "",
    meetingLink: (c?.meeting_link as string | null) ?? "",
    defaultMinutes: (c?.default_minutes as number | undefined) ?? 60,
  };
}

export async function getMyCoachBasics(): Promise<CoachBasics> {
  const me = await requireStaff();
  return basicsFor(me.id);
}

// An admin looking at any coach's basics (Settings → Team).
export async function getCoachBasics(coachId: string): Promise<CoachBasics> {
  await requireAdmin();
  return basicsFor(coachId);
}

export async function saveMyCoachBasics(input: {
  fullName: string;
  phone: string;
  timezone: string;
  bio: string;
  credentials: string;
  meetingLink: string;
  defaultMinutes: number;
  photoPath: string | null;
}): Promise<Result> {
  const me = await requireStaff();
  const fullName = input.fullName.trim().slice(0, 120);
  if (!fullName) return { ok: false, message: "Add your name." };
  const timezone = input.timezone.trim();
  if (!validZone(timezone)) return { ok: false, message: "Choose a time zone from the list." };
  const link = input.meetingLink.trim();
  if (link && !/^https:\/\/\S+$/.test(link)) return { ok: false, message: "The meeting link should start https://" };
  const minutes = Math.round(input.defaultMinutes);
  if (!(minutes >= 15 && minutes <= 240)) return { ok: false, message: "Session length should be between 15 and 240 minutes." };
  const photo = input.photoPath && input.photoPath.startsWith(`${me.id}/`) ? input.photoPath : null;
  const supabase = await createClient();
  const [profile, basics] = await Promise.all([
    supabase.from("profiles").update({ full_name: fullName, phone: input.phone.trim().slice(0, 40) || null, timezone: timezone || null }).eq("id", me.id),
    supabase.from("coach_public").upsert(
      { coach_id: me.id, bio: input.bio.trim().slice(0, 1500), credentials: input.credentials.trim().slice(0, 1000), meeting_link: link || null, default_minutes: minutes, photo_path: photo },
      { onConflict: "coach_id" }
    ),
  ]);
  if (profile.error || basics.error) return { ok: false, message: "Couldn’t save — try again." };
  revalidatePath("/coach", "layout");
  return { ok: true };
}

// What a member sees about their own coach (Coaching page).
export async function getMyCoach(): Promise<{ name: string; photoUrl: string | null; bio: string; credentials: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_coach");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.full_name) return null;
  return { name: row.full_name as string, photoUrl: photoUrl(row.photo_path as string | null), bio: (row.bio as string) ?? "", credentials: (row.credentials as string) ?? "" };
}

// ---- Client admin -------------------------------------------------------

export type ClientRecord = { available: boolean; status: "active" | "paused" | "former"; startedOn: string; source: string };

export async function getClientRecord(clientId: string): Promise<ClientRecord> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_records").select("status, started_on, source").eq("client_id", clientId).maybeSingle();
  if (error) return { available: false, status: "active", startedOn: "", source: "" };
  return {
    available: true,
    status: ((data?.status as ClientRecord["status"] | undefined) ?? "active"),
    startedOn: (data?.started_on as string | null) ?? "",
    source: (data?.source as string | null) ?? "",
  };
}

export async function saveClientRecord(clientId: string, input: { status: string; startedOn: string; source: string }): Promise<Result> {
  const me = await requireStaff();
  if (!["active", "paused", "former"].includes(input.status)) return { ok: false, message: "Choose a status." };
  if (input.startedOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.startedOn)) return { ok: false, message: "Choose a start date." };
  const supabase = await createClient();
  const { error } = await supabase.from("client_records").upsert(
    { client_id: clientId, status: input.status, started_on: input.startedOn || null, source: input.source.trim().slice(0, 200) || null, updated_by: me.id },
    { onConflict: "client_id" }
  );
  if (error) return { ok: false, message: "Couldn’t save — try again." };
  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/coach/clients");
  return { ok: true };
}

export async function getAdminNotes(clientId: string): Promise<{ available: boolean; notes: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_admin_notes").select("notes").eq("client_id", clientId).maybeSingle();
  if (error) return { available: false, notes: "" };
  return { available: true, notes: (data?.notes as string | undefined) ?? "" };
}

export async function saveAdminNotes(clientId: string, notes: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("client_admin_notes").upsert({ client_id: clientId, notes: notes.trim().slice(0, 4000) }, { onConflict: "client_id" });
  if (error) return { ok: false, message: "Couldn’t save — try again." };
  revalidatePath(`/coach/clients/${clientId}`);
  return { ok: true };
}

export async function staffSaveClientDetails(
  clientId: string,
  input: { fullName: string; preferredName: string; phone: string; town: string; country: string; timezone: string }
): Promise<Result> {
  await requireStaff();
  if (!input.fullName.trim()) return { ok: false, message: "A name is needed." };
  if (!validZone(input.timezone.trim())) return { ok: false, message: "Choose a time zone from the list." };
  const clip = (s: string, n: number) => s.trim().slice(0, n);
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_save_client_details", {
    p_client: clientId,
    p_full_name: clip(input.fullName, 120),
    p_preferred_name: clip(input.preferredName, 80),
    p_phone: clip(input.phone, 40),
    p_town: clip(input.town, 120),
    p_country: clip(input.country, 80),
    p_timezone: clip(input.timezone, 64),
  });
  if (error) return { ok: false, message: "Couldn’t save — try again." };
  revalidatePath(`/coach/clients/${clientId}`);
  return { ok: true };
}

// The client's intention for this month (coaches can read it, like goals).
export async function getClientIntention(clientId: string): Promise<string | null> {
  await requireStaff();
  const supabase = await createClient();
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  const { data } = await supabase.from("monthly_intentions").select("intention").eq("client_id", clientId).eq("month", month).maybeSingle();
  return (data?.intention as string | undefined) ?? null;
}
