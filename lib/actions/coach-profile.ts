"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/actions/admin";

// The coach's own profile and what they know about each client (migration
// 0026), private to that coach. Read by the coaching reflection before it
// judges a session; updated by the coach, or from a "Discuss" proposal they
// accept. `available` is false until 0026 has run.

export type LearningArea = { id: string; text: string; added: string };
export type CoachProfile = { available: boolean; approach: string; workingOn: LearningArea[] };
type Result = { ok: true } | { ok: false; message: string };

const today = () => new Date().toISOString().slice(0, 10);
const cleanAreas = (v: unknown): LearningArea[] =>
  (Array.isArray(v) ? v : [])
    .filter((a) => a && typeof a.text === "string" && a.text.trim())
    .map((a) => ({ id: typeof a.id === "string" && a.id ? a.id : crypto.randomUUID(), text: a.text.trim().slice(0, 400), added: typeof a.added === "string" ? a.added : today() }))
    .slice(0, 12);

export async function getCoachProfile(): Promise<CoachProfile> {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("coach_profiles").select("approach, working_on").eq("coach_id", me.id).maybeSingle();
  if (error) return { available: false, approach: "", workingOn: [] };
  return { available: true, approach: (data?.approach as string | undefined) ?? "", workingOn: cleanAreas(data?.working_on) };
}

export async function saveCoachProfile(input: { approach: string; workingOn: { id?: string; text: string; added?: string }[] }): Promise<Result> {
  const me = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_profiles")
    .upsert({ coach_id: me.id, approach: input.approach.trim().slice(0, 4000), working_on: cleanAreas(input.workingOn) }, { onConflict: "coach_id" });
  if (error) return { ok: false, message: "Couldn’t save your profile — try again." };
  revalidatePath("/coach/profile");
  return { ok: true };
}

export async function getClientContext(clientId: string): Promise<{ available: boolean; notes: string }> {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_contexts").select("notes").eq("coach_id", me.id).eq("client_id", clientId).maybeSingle();
  if (error) return { available: false, notes: "" };
  return { available: true, notes: (data?.notes as string | undefined) ?? "" };
}

export async function saveClientContext(clientId: string, notes: string): Promise<Result> {
  const me = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("client_contexts").upsert({ coach_id: me.id, client_id: clientId, notes: notes.trim().slice(0, 4000) }, { onConflict: "coach_id,client_id" });
  if (error) return { ok: false, message: "Couldn’t save — try again." };
  revalidatePath(`/coach/clients/${clientId}`, "layout");
  return { ok: true };
}

// Add one accepted line from a discussion to the profile or client context.
export async function addToProfile(input: { target: "approach" | "working_on" | "client_context"; text: string; clientId?: string }): Promise<Result> {
  const line = input.text.trim().slice(0, 400);
  if (!line) return { ok: false, message: "Nothing to add." };
  if (input.target === "client_context") {
    if (!input.clientId) return { ok: false, message: "Which client?" };
    const current = await getClientContext(input.clientId);
    return saveClientContext(input.clientId, [current.notes.trim(), line].filter(Boolean).join("\n"));
  }
  const p = await getCoachProfile();
  if (input.target === "approach") return saveCoachProfile({ approach: [p.approach.trim(), line].filter(Boolean).join("\n"), workingOn: p.workingOn });
  return saveCoachProfile({ approach: p.approach, workingOn: [...p.workingOn, { text: line, added: today() }] });
}
