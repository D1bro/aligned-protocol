"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/actions/admin";
import { cleanAreas, type CalibratedArea } from "@/lib/calibration";

// "Take your chart further" (migration 0028): the calibrated chart for one
// coaching session. The coach saves it as they go and shares it when ready;
// the client sees it only once shared. The audit is never changed.

export type Calibration = { id: string; auditId: string; status: "draft" | "shared"; sharedAt: string | null; createdAt: string; areas: CalibratedArea[] };
type Result = { ok: true } | { ok: false; message: string };

async function areaIds() {
  const supabase = await createClient();
  const { data } = await supabase.from("life_areas").select("id").order("sort_order");
  return (data ?? []).map((a) => a.id as string);
}

const toCalibration = (row: Record<string, unknown>, ids: string[]): Calibration => ({
  id: row.id as string,
  auditId: row.audit_id as string,
  status: row.status === "shared" ? "shared" : "draft",
  sharedAt: (row.shared_at as string | null) ?? null,
  createdAt: row.created_at as string,
  areas: cleanAreas(row.areas, ids),
});

// The session's calibrated chart, if one has been started.
export async function getSessionCalibration(sessionId: string): Promise<{ available: boolean; calibration: Calibration | null }> {
  await requireStaff();
  const supabase = await createClient();
  const [{ data, error }, ids] = await Promise.all([supabase.from("chart_calibrations").select("*").eq("session_id", sessionId).maybeSingle(), areaIds()]);
  if (error) return { available: false, calibration: null };
  return { available: true, calibration: data ? toCalibration(data, ids) : null };
}

// The client's most recent calibrated chart (any status), for the coach.
export async function getLatestCalibration(clientId: string): Promise<Calibration | null> {
  await requireStaff();
  const supabase = await createClient();
  const [{ data }, ids] = await Promise.all([
    supabase.from("chart_calibrations").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    areaIds(),
  ]);
  return data ? toCalibration(data, ids) : null;
}

export async function saveCalibration(input: { sessionId: string; clientId: string; auditId: string; areas: CalibratedArea[] }): Promise<Result> {
  const me = await requireStaff();
  const supabase = await createClient();
  const areas = cleanAreas(input.areas, await areaIds());
  const { error } = await supabase
    .from("chart_calibrations")
    .upsert({ session_id: input.sessionId, client_id: input.clientId, audit_id: input.auditId, coach_id: me.id, areas }, { onConflict: "session_id" });
  if (error) return { ok: false, message: "Couldn’t save the chart — try again." };
  revalidatePath(`/coach/clients/${input.clientId}/sessions/${input.sessionId}`);
  return { ok: true };
}

export async function shareCalibration(sessionId: string, clientId: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chart_calibrations")
    .update({ status: "shared", shared_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Save the chart first, then share it." };
  revalidatePath(`/coach/clients/${clientId}/sessions/${sessionId}`);
  revalidatePath("/journey");
  return { ok: true };
}

// For the member: their most recent shared calibrated chart, with area names.
export async function getMyCalibratedChart(): Promise<{ sharedAt: string; areas: (CalibratedArea & { name: string })[] } | null> {
  const supabase = await createClient();
  const [{ data, error }, { data: areas }] = await Promise.all([
    supabase.from("chart_calibrations").select("areas, shared_at").eq("status", "shared").order("shared_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("life_areas").select("id, name").order("sort_order"),
  ]);
  if (error || !data) return null;
  const names = new Map((areas ?? []).map((a) => [a.id as string, a.name as string]));
  return {
    sharedAt: data.shared_at as string,
    areas: cleanAreas(data.areas, [...names.keys()]).map((a) => ({ ...a, name: names.get(a.life_area_id) ?? "" })),
  };
}
