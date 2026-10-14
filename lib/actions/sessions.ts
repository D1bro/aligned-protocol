"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/actions/admin";
import { localToUtc, BUSINESS_TZ } from "@/lib/time";

// Coaching sessions. Each change is its own step (book, confirm, reschedule,
// mark held, cancel, no-show) and only applies from the states it makes sense
// in, so a repeated click or a stale page can't move a session twice. Access
// is enforced by the database (assigned coach or admin); the client id is
// never taken on trust from the browser for anything but the lookup.

export type SessionState = "proposed" | "confirmed" | "held" | "cancelled" | "no_show";

export type CoachingSession = {
  id: string;
  client_id: string;
  coach_id: string | null;
  scheduled_at: string;
  timezone: string;
  duration_minutes: number;
  state: SessionState;
  location: string | null;
  previous_session_id: string | null;
  audit_id: string | null;
  goal_id: string | null;
  goal_snapshot: { goal_title?: string; action_text?: string; success_criteria?: string; focus_area?: string } | null;
  held_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  no_show_decision: string | null;
  created_at: string;
};

export type SessionEvent = {
  id: string;
  session_id: string;
  kind: string;
  from_at: string | null;
  to_at: string | null;
  note: string | null;
  created_at: string;
};

type Result = { ok: true; id?: string } | { ok: false; message: string };

function paths(clientId: string, sessionId?: string) {
  revalidatePath(`/coach/clients/${clientId}`);
  if (sessionId) revalidatePath(`/coach/clients/${clientId}/sessions/${sessionId}`);
  revalidatePath("/coach");
  revalidatePath("/coaching");
}

export async function getSessions(clientId: string): Promise<{ sessions: CoachingSession[]; events: SessionEvent[] }> {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase.from("coaching_sessions").select("*").eq("client_id", clientId).order("scheduled_at", { ascending: false }),
    supabase.from("coaching_session_events").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
  ]);
  return { sessions: (sessions ?? []) as CoachingSession[], events: (events ?? []) as SessionEvent[] };
}

export async function getSession(sessionId: string): Promise<CoachingSession | null> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("coaching_sessions").select("*").eq("id", sessionId).maybeSingle();
  return (data as CoachingSession | null) ?? null;
}

async function logEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  s: { id: string; client_id: string },
  kind: string,
  extra: { from_at?: string | null; to_at?: string | null; note?: string | null } = {}
) {
  await supabase.from("coaching_session_events").insert({ session_id: s.id, client_id: s.client_id, kind, actor_id: actorId, ...extra });
  await supabase.from("audit_events").insert({
    actor_id: actorId,
    client_id: s.client_id,
    action: `session.${kind}`,
    target_type: "coaching_session",
    target_id: s.id,
  });
}

// Book a session. Context (latest audit, main goal and its wording) is taken
// from the client's own records at booking time, not from the form.
export async function createSession(input: {
  clientId: string;
  date: string;
  time: string;
  durationMinutes: number;
  location: string;
  confirmed: boolean;
}): Promise<Result> {
  const me = await requireStaff();
  const at = localToUtc(input.date, input.time, BUSINESS_TZ);
  if (!at) return { ok: false, message: "Choose a valid date and time (UK time)." };
  const duration = Math.round(Number(input.durationMinutes));
  if (!Number.isFinite(duration) || duration < 5 || duration > 600) return { ok: false, message: "Duration must be between 5 and 600 minutes." };

  const supabase = await createClient();
  const [{ data: audit }, { data: goals }, { data: prev }] = await Promise.all([
    supabase
      .from("audits")
      .select("id")
      .eq("client_id", input.clientId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, goal_title, action_text, success_criteria, focus_area, goal_type, created_at")
      .eq("client_id", input.clientId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("coaching_sessions")
      .select("id")
      .eq("client_id", input.clientId)
      .in("state", ["held", "confirmed", "proposed"])
      .lt("scheduled_at", at.toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  // Same main-goal rule as My profile / My plan: newest active 'primary'.
  const main = (goals ?? []).find((g) => g.goal_type === "primary") ?? (goals ?? [])[0] ?? null;

  const { data, error } = await supabase
    .from("coaching_sessions")
    .insert({
      client_id: input.clientId,
      coach_id: me.id,
      scheduled_at: at.toISOString(),
      timezone: BUSINESS_TZ,
      duration_minutes: duration,
      state: input.confirmed ? "confirmed" : "proposed",
      location: input.location.trim() || null,
      previous_session_id: prev?.id ?? null,
      audit_id: audit?.id ?? null,
      goal_id: main?.id ?? null,
      goal_snapshot: main
        ? { goal_title: main.goal_title, action_text: main.action_text, success_criteria: main.success_criteria, focus_area: main.focus_area }
        : null,
      created_by: me.id,
    })
    .select("id, client_id")
    .single();
  if (error || !data) return { ok: false, message: "Couldn’t book the session — check you coach this client and try again." };
  await logEvent(supabase, me.id, data, "created", { to_at: at.toISOString() });
  if (input.confirmed) await logEvent(supabase, me.id, data, "confirmed");
  paths(input.clientId, data.id);
  return { ok: true, id: data.id };
}

// Move a session to a new state only from the states it can come from.
async function transition(
  sessionId: string,
  from: SessionState[],
  patch: Record<string, unknown>,
  kind: string,
  note?: string | null
): Promise<Result> {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaching_sessions")
    .update(patch)
    .eq("id", sessionId)
    .in("state", from)
    .select("id, client_id");
  if (error) return { ok: false, message: "Couldn’t save — try again." };
  if (!data?.length) return { ok: false, message: "This session has already changed. Reload to see its current state." };
  await logEvent(supabase, me.id, data[0], kind, { note: note ?? null });
  paths(data[0].client_id, sessionId);
  return { ok: true };
}

export async function confirmSession(sessionId: string) {
  return transition(sessionId, ["proposed"], { state: "confirmed" }, "confirmed");
}

export async function markHeld(sessionId: string) {
  return transition(sessionId, ["proposed", "confirmed"], { state: "held", held_at: new Date().toISOString() }, "held");
}

export async function cancelSession(sessionId: string, reason: string) {
  return transition(
    sessionId,
    ["proposed", "confirmed"],
    { state: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason.trim() || null },
    "cancelled",
    reason.trim() || null
  );
}

// A no-show is recorded, but what it means for payment is a separate,
// explicit decision (none is assumed).
export async function markNoShow(sessionId: string, decision: string) {
  return transition(
    sessionId,
    ["confirmed"],
    { state: "no_show", no_show_decision: decision.trim() || null },
    "no_show",
    decision.trim() || null
  );
}

// Same session, new time: history keeps the old and new times.
export async function rescheduleSession(sessionId: string, date: string, time: string): Promise<Result> {
  const me = await requireStaff();
  const at = localToUtc(date, time, BUSINESS_TZ);
  if (!at) return { ok: false, message: "Choose a valid date and time (UK time)." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("coaching_sessions").select("id, client_id, scheduled_at, state").eq("id", sessionId).maybeSingle();
  if (!current) return { ok: false, message: "Session not found." };
  if (!["proposed", "confirmed"].includes(current.state)) return { ok: false, message: "Only upcoming sessions can be moved." };
  const { data, error } = await supabase
    .from("coaching_sessions")
    .update({ scheduled_at: at.toISOString() })
    .eq("id", sessionId)
    .eq("scheduled_at", current.scheduled_at)
    .in("state", ["proposed", "confirmed"])
    .select("id, client_id");
  if (error) return { ok: false, message: "Couldn’t save — try again." };
  if (!data?.length) return { ok: false, message: "This session has already changed. Reload to see its current state." };
  await logEvent(supabase, me.id, data[0], "rescheduled", { from_at: current.scheduled_at, to_at: at.toISOString() });
  paths(current.client_id, sessionId);
  return { ok: true };
}

// Private coach notes -------------------------------------------------------

export type CoachNote = {
  id: string;
  client_id: string;
  session_id: string | null;
  author_id: string;
  body: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export async function getCoachNotes(clientId: string): Promise<CoachNote[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("coach_notes").select("*").eq("client_id", clientId).order("updated_at", { ascending: false });
  return (data ?? []) as CoachNote[];
}

export type NoteSave =
  | { ok: true; note: CoachNote }
  | { ok: false; conflict: true; current: CoachNote; message: string }
  | { ok: false; conflict?: false; message: string };

// Save a private note. With a version check, so two open tabs can't silently
// overwrite each other: on a clash the other version comes back to compare.
export async function saveCoachNote(input: {
  noteId: string | null;
  clientId: string;
  sessionId: string | null;
  body: string;
  expectedVersion: number | null;
}): Promise<NoteSave> {
  const me = await requireStaff();
  const supabase = await createClient();
  const body = input.body.slice(0, 50_000);

  if (input.noteId) {
    const { data, error } = await supabase
      .from("coach_notes")
      .update({ body, version: (input.expectedVersion ?? 0) + 1 })
      .eq("id", input.noteId)
      .eq("version", input.expectedVersion ?? -1)
      .select("*");
    if (error) return { ok: false, message: "Couldn’t save — your text is still here. Try again." };
    if (data?.length) {
      revalidatePath(`/coach/clients/${input.clientId}`);
      return { ok: true, note: data[0] as CoachNote };
    }
    const { data: current } = await supabase.from("coach_notes").select("*").eq("id", input.noteId).maybeSingle();
    if (current) {
      return { ok: false, conflict: true, current: current as CoachNote, message: "This note was changed elsewhere. Compare and choose which to keep." };
    }
    return { ok: false, message: "This note no longer exists." };
  }

  const { data, error } = await supabase
    .from("coach_notes")
    .insert({ client_id: input.clientId, session_id: input.sessionId, author_id: me.id, body })
    .select("*")
    .single();
  if (error || !data) {
    // One note per session per author: if it already exists, hand it back.
    if (input.sessionId) {
      const { data: existing } = await supabase
        .from("coach_notes")
        .select("*")
        .eq("session_id", input.sessionId)
        .eq("author_id", me.id)
        .maybeSingle();
      if (existing) {
        return { ok: false, conflict: true, current: existing as CoachNote, message: "There's already a note for this session. Compare and choose which to keep." };
      }
    }
    return { ok: false, message: "Couldn’t save — your text is still here. Try again." };
  }
  revalidatePath(`/coach/clients/${input.clientId}`);
  return { ok: true, note: data as CoachNote };
}
