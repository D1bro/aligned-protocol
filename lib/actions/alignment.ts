"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  addCalendarDays, checkDailyAlignment, checkWeeklyAlignment, isAlignmentDate,
  isAlignmentSchemaMissing, isAlignmentTimeZone, localDate, normalizeTimeZone, weekStart,
  type AlignmentDaily, type AlignmentWeekly, type AlignmentData, type AlignmentResult,
  type DailyAlignmentInput, type WeeklyAlignmentInput,
} from "@/lib/alignment";

const DAILY_COLUMNS = "id,client_id,entry_date,timezone,presence_done,priority,goal_id,value,wellbeing_action,evening_note,wellbeing,meaningful_action,participation,values_choice,created_at,updated_at";
const WEEKLY_COLUMNS = "id,client_id,week_start,timezone,helped,adjustment,next_priority,created_at,updated_at";
const unavailable = "Saving isn’t available yet. Your draft is still here; try again when Daily Alignment is ready.";

async function requireMember() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");
  if (error) throw new Error("Couldn’t verify your sign-in. Please try again.");
  return { supabase, userId: user.id };
}
function refreshAlignment() {
  revalidatePath("/alignment");
  revalidatePath("/");
  revalidatePath("/summary");
}

export async function getAlignmentData(options: { date?: string; timezone?: string } = {}): Promise<AlignmentData> {
  const { supabase, userId } = await requireMember();
  let timezone = normalizeTimeZone(options.timezone);
  if (options.timezone !== undefined && !isAlignmentTimeZone(options.timezone)) throw new Error("Choose a valid time zone.");
  if (options.timezone === undefined) {
    const { data: profile, error } = await supabase.from("profiles").select("timezone").eq("id", userId).single();
    // Migration 0016 may also be pending. Only an absent timezone column falls
    // back; connection/permission errors must not look like a blank profile.
    if (error && error.code !== "42703" && error.code !== "PGRST204") throw new Error("Couldn’t load your time zone. Please try again.");
    timezone = normalizeTimeZone(profile?.timezone);
  }
  const today = localDate(timezone);
  const date = options.date ?? today;
  if (!isAlignmentDate(date)) throw new Error("Choose a valid calendar date.");
  const start = weekStart(date);
  const empty: AlignmentData = { available: false, daily: null, days: [], weekly: null, date, today, week_start: start, timezone, goals: [] };
  const [daily, weekly, goals] = await Promise.all([
    supabase.from("daily_alignments").select(DAILY_COLUMNS).eq("client_id", userId)
      .gte("entry_date", start).lt("entry_date", addCalendarDays(start, 7)).order("entry_date"),
    supabase.from("alignment_weekly_reviews").select(WEEKLY_COLUMNS).eq("client_id", userId).eq("week_start", start).maybeSingle(),
    supabase.from("goals").select("id,goal_title,goal_type").eq("client_id", userId).eq("status", "active")
      .order("goal_type", { ascending: true }).order("created_at", { ascending: false }),
  ]);
  // Only an explicitly missing migration becomes 'not available'. An empty
  // week remains available; any other read error is a visible failure.
  if (daily.error && !isAlignmentSchemaMissing(daily.error)) throw new Error("Couldn’t load your daily entries. Please try again.");
  if (weekly.error && !isAlignmentSchemaMissing(weekly.error)) throw new Error("Couldn’t load your weekly review. Please try again.");
  if (goals.error) throw new Error("Couldn’t load your goals. Please try again.");
  if (isAlignmentSchemaMissing(daily.error) || isAlignmentSchemaMissing(weekly.error)) return empty;
  const days = (daily.data ?? []) as AlignmentDaily[];
  return { ...empty, available: true, days, daily: days.find((d) => d.entry_date === date) ?? null,
    weekly: weekly.data as AlignmentWeekly | null, goals: goals.data ?? [] };
}

export async function getAlignmentHistory(): Promise<{ available: boolean; weekly: AlignmentWeekly[] }> {
  const { supabase, userId } = await requireMember();
  const { data, error } = await supabase.from("alignment_weekly_reviews").select(WEEKLY_COLUMNS)
    .eq("client_id", userId).order("week_start", { ascending: false }).limit(12);
  if (isAlignmentSchemaMissing(error)) return { available: false, weekly: [] };
  if (error) throw new Error("Couldn’t load your weekly reviews. Please try again.");
  return { available: true, weekly: (data ?? []) as AlignmentWeekly[] };
}

export async function saveDailyAlignment(input: Partial<Record<keyof DailyAlignmentInput, unknown>>): Promise<AlignmentResult<AlignmentDaily>> {
  const { supabase, userId } = await requireMember();
  const checked = checkDailyAlignment(input);
  if (!checked.ok) return checked;
  if (checked.values.goal_id) {
    const goal = await supabase.from("goals").select("id").eq("id", checked.values.goal_id).eq("client_id", userId).maybeSingle();
    if (goal.error) return { ok: false, message: "Couldn’t check your goal. Your draft is still here; please try again." };
    if (!goal.data) return { ok: false, field: "goal_id", message: "Choose one of your own goals, or leave this blank." };
  }
  const { data, error } = await supabase.from("daily_alignments")
    .upsert({ ...checked.values, client_id: userId }, { onConflict: "client_id,entry_date" }).select(DAILY_COLUMNS).single();
  if (isAlignmentSchemaMissing(error)) return { ok: false, message: unavailable };
  if (error || !data) return { ok: false, message: "Couldn’t save your daily entry. Your draft is still here; please try again." };
  refreshAlignment();
  return { ok: true, entry: data as AlignmentDaily };
}

export async function saveWeeklyAlignment(input: Partial<Record<keyof WeeklyAlignmentInput, unknown>>): Promise<AlignmentResult<AlignmentWeekly>> {
  const { supabase, userId } = await requireMember();
  const checked = checkWeeklyAlignment(input);
  if (!checked.ok) return checked;
  const { data, error } = await supabase.from("alignment_weekly_reviews")
    .upsert({ ...checked.values, client_id: userId }, { onConflict: "client_id,week_start" }).select(WEEKLY_COLUMNS).single();
  if (isAlignmentSchemaMissing(error)) return { ok: false, message: unavailable };
  if (error || !data) return { ok: false, message: "Couldn’t save your weekly review. Your draft is still here; please try again." };
  refreshAlignment();
  return { ok: true, entry: data as AlignmentWeekly };
}

type ChangeResult = { ok: true } | { ok: false; message: string };
export async function deleteDailyAlignment(date: string): Promise<ChangeResult> {
  const { supabase, userId } = await requireMember();
  if (!isAlignmentDate(date)) return { ok: false, message: "Choose a valid calendar date." };
  const { error } = await supabase.from("daily_alignments").delete().eq("client_id", userId).eq("entry_date", date);
  if (isAlignmentSchemaMissing(error)) return { ok: false, message: unavailable };
  if (error) return { ok: false, message: "Couldn’t delete this daily entry. Please try again." };
  refreshAlignment();
  return { ok: true };
}
export async function deleteWeeklyAlignment(date: string): Promise<ChangeResult> {
  const { supabase, userId } = await requireMember();
  if (!isAlignmentDate(date) || weekStart(date) !== date) return { ok: false, message: "Choose the Monday at the start of this week." };
  const { error } = await supabase.from("alignment_weekly_reviews").delete().eq("client_id", userId).eq("week_start", date);
  if (isAlignmentSchemaMissing(error)) return { ok: false, message: unavailable };
  if (error) return { ok: false, message: "Couldn’t delete this weekly review. Please try again." };
  refreshAlignment();
  return { ok: true };
}

export async function exportAlignmentData(): Promise<
  { ok: true; data: { daily: AlignmentDaily[]; weekly: AlignmentWeekly[]; exported_at: string } } | { ok: false; message: string }
> {
  const { supabase, userId } = await requireMember();
  // Supabase caps each response. Explicit pages ensure export includes history
  // longer than that cap, without ever querying another member's entries.
  const daily: AlignmentDaily[] = [];
  const weekly: AlignmentWeekly[] = [];
  const pageSize = 500;
  for (const table of ["daily_alignments", "alignment_weekly_reviews"] as const) {
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabase.from(table).select(table === "daily_alignments" ? DAILY_COLUMNS : WEEKLY_COLUMNS)
        .eq("client_id", userId).order(table === "daily_alignments" ? "entry_date" : "week_start")
        .range(offset, offset + pageSize - 1);
      if (isAlignmentSchemaMissing(result.error)) return { ok: false, message: "Daily Alignment isn’t available yet. Please try again when it is ready." };
      if (result.error) return { ok: false, message: "Couldn’t export your entries. Please try again." };
      const rows = result.data ?? [];
      if (table === "daily_alignments") daily.push(...rows as unknown as AlignmentDaily[]);
      else weekly.push(...rows as unknown as AlignmentWeekly[]);
      if (rows.length < pageSize) break;
    }
  }
  return { ok: true, data: { daily, weekly, exported_at: new Date().toISOString() } };
}
