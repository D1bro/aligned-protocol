"use server";

// The Daily Alignment's reads and writes (Duane's build brief v1, 11 Nov
// 2026). Every write is the member's own, through the database's rules
// (migration 0034). "Today" is the site's calendar day (lib/time), the same
// day the Next Step ticks use.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";
import { addDays } from "@/lib/daily-log";
import { type ActionLog, type DailyAction, type Measure, type Period, type TimerRow, periodStart, weekEvidence, weekStartOf } from "@/lib/daily-alignment";

type Result = { ok: true } | { ok: false; message: string };
const FAILED = "Couldn’t save. Check your connection and try again.";
const NOT_READY = "The Daily Alignment isn’t switched on yet (database update 0034).";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id, anonymous: !!user.is_anonymous };
}

function revalidate() {
  revalidatePath("/daily");
  revalidatePath("/");
}

export type CheckIn = { rating: number; note: string };
export type DailyData = {
  available: boolean;
  today: string;
  serverNow: number;
  actions: DailyAction[];
  logs: ActionLog[];
  timer: TimerRow | null;
  checkIn: CheckIn | null;
  // The last day anything was logged or checked in, before today.
  lastActive: string | null;
  weekCheckIns: { date: string; rating: number }[];
  weekNotes: { id: string; date: string; text: string }[];
};

// Everything the Daily page shows: their actions (not archived), the logs
// since the start of the month or week (whichever is earlier), the running
// timer and today's check-in.
export async function getDaily(): Promise<DailyData> {
  const { supabase, userId } = await me();
  const today = localDate(new Date());
  const from = [periodStart("month", today), weekStartOf(today)].sort()[0];
  const weekFrom = weekStartOf(today);
  const [actions, logs, timer, checkIns, notes, lastLog] = await Promise.all([
    supabase.from("daily_actions").select("*").eq("client_id", userId).neq("status", "archived").order("position").order("created_at"),
    supabase.from("daily_action_logs").select("id, action_id, log_date, tick, amount, seconds, source, note").eq("client_id", userId).gte("log_date", from).lte("log_date", today),
    supabase.from("mindful_timers").select("action_id, planned_seconds, started_at, paused_at, paused_seconds, intention").eq("client_id", userId).maybeSingle(),
    supabase.from("daily_checkins").select("checkin_date, rating, journal_entry_id").eq("client_id", userId).gte("checkin_date", addDays(today, -30)).order("checkin_date", { ascending: false }),
    supabase.from("journal_entries").select("id, entry_date, body").eq("client_id", userId).gte("entry_date", weekFrom).lte("entry_date", today).order("entry_date", { ascending: false }).limit(20),
    supabase.from("daily_action_logs").select("log_date").eq("client_id", userId).lt("log_date", today).order("log_date", { ascending: false }).limit(1),
  ]);
  if (actions.error) {
    return { available: false, today, serverNow: Date.now(), actions: [], logs: [], timer: null, checkIn: null, lastActive: null, weekCheckIns: [], weekNotes: [] };
  }
  const checkInRows = (checkIns.data ?? []) as { checkin_date: string; rating: number; journal_entry_id: string | null }[];
  const todayRow = checkInRows.find((c) => c.checkin_date === today) ?? null;
  let todayNote = "";
  if (todayRow?.journal_entry_id) {
    const { data } = await supabase.from("journal_entries").select("body").eq("id", todayRow.journal_entry_id).maybeSingle();
    todayNote = (data?.body as string | undefined) ?? "";
  }
  const lastCheckIn = checkInRows.find((c) => c.checkin_date < today)?.checkin_date ?? null;
  const lastLogged = (lastLog.data?.[0]?.log_date as string | undefined) ?? null;
  return {
    available: true,
    today,
    serverNow: Date.now(),
    actions: ((actions.data ?? []) as DailyAction[]).map((a) => ({ ...a, days: a.days ?? [] })),
    logs: (logs.data ?? []) as ActionLog[],
    timer: (timer.data as TimerRow | null) ?? null,
    checkIn: todayRow ? { rating: todayRow.rating, note: todayNote } : null,
    lastActive: [lastCheckIn, lastLogged].filter(Boolean).sort().at(-1) ?? null,
    weekCheckIns: checkInRows.filter((c) => c.checkin_date >= weekFrom).map((c) => ({ date: c.checkin_date, rating: c.rating })),
    weekNotes: ((notes.data ?? []) as { id: string; entry_date: string; body: string }[]).map((n) => ({ id: n.id, date: n.entry_date, text: n.body.trim().split("\n")[0].slice(0, 140) })),
  };
}

export type ActionInput = {
  id?: string;
  name: string;
  measure: Measure;
  target: number | null;
  period: Period;
  unit: string;
  lifeAreaId: string | null;
  goalId: string | null;
  days: number[];
  atTime: string | null;
  startDate: string | null;
  endDate: string | null;
  mindful: boolean;
  private: boolean;
};

const ymd = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

// Add or change an action. A run starts the day it's added (or its start date).
export async function saveDailyAction(input: ActionInput): Promise<Result> {
  const { supabase, userId, anonymous } = await me();
  if (anonymous) return { ok: false, message: "Save your work to a free account first." };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, message: "Give it a name." };
  if (!["done", "count", "minutes", "run"].includes(input.measure)) return { ok: false, message: "Choose how you’ll measure it." };
  const target = input.target && input.target > 0 ? Math.min(100000, Math.round(input.target)) : null;
  const atTime = input.atTime && /^\d{2}:\d{2}$/.test(input.atTime) ? input.atTime : null;
  const start = ymd(input.startDate) ?? localDate(new Date());
  const end = ymd(input.endDate);
  if (end && end < start) return { ok: false, message: "The end date is before the start." };
  const row = {
    name,
    measure: input.measure,
    target: input.measure === "run" ? null : target,
    period: (["day", "week", "month"] as Period[]).includes(input.period) ? input.period : "week",
    unit: input.unit.trim().slice(0, 30) || null,
    life_area_id: input.lifeAreaId || null,
    goal_id: input.goalId || null,
    days: [...new Set(input.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(),
    at_time: input.measure === "run" ? null : atTime,
    start_date: start,
    end_date: end,
    mindful: input.measure === "minutes" && input.mindful,
    private: input.private,
  };
  if (input.id) {
    const { data, error } = await supabase.from("daily_actions").update(row).eq("id", input.id).eq("client_id", userId).select("id");
    if (error || !data?.length) return { ok: false, message: error?.code === "42P01" ? NOT_READY : FAILED };
  } else {
    const { count } = await supabase.from("daily_actions").select("id", { count: "exact", head: true }).eq("client_id", userId);
    const { error } = await supabase.from("daily_actions").insert({
      ...row,
      client_id: userId,
      position: count ?? 0,
      run_started: input.measure === "run" ? start : null,
    });
    if (error) return { ok: false, message: error.code === "42P01" ? NOT_READY : FAILED };
  }
  revalidate();
  return { ok: true };
}

// Pause, finish or archive it, or bring it back.
export async function setDailyActionStatus(id: string, status: DailyAction["status"]): Promise<Result> {
  const { supabase, userId } = await me();
  if (!["active", "paused", "completed", "archived"].includes(status)) return { ok: false, message: FAILED };
  const { data, error } = await supabase.from("daily_actions").update({ status }).eq("id", id).eq("client_id", userId).select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}

async function ownAction(id: string) {
  const { supabase, userId } = await me();
  const { data } = await supabase.from("daily_actions").select("*").eq("id", id).eq("client_id", userId).maybeSingle();
  return { supabase, userId, action: (data as DailyAction | null) ?? null };
}

const dayOrToday = (day?: string | null) => {
  const today = localDate(new Date());
  const d = ymd(day);
  return d && d <= today ? d : today;
};

// A "done" action: today's tick, on or off. One per day.
export async function tickDailyAction(id: string, done: boolean, day?: string): Promise<Result> {
  const { supabase, userId, action } = await ownAction(id);
  if (!action) return { ok: false, message: FAILED };
  const date = dayOrToday(day);
  if (!done) {
    const { error } = await supabase.from("daily_action_logs").delete().eq("action_id", id).eq("log_date", date).eq("tick", true);
    if (error) return { ok: false, message: FAILED };
  } else {
    const { error } = await supabase.from("daily_action_logs").insert({ client_id: userId, action_id: id, log_date: date, tick: true });
    if (error && error.code !== "23505") return { ok: false, message: FAILED };
  }
  revalidate();
  return { ok: true };
}

// A count: add one (or take one off) for the day.
export async function countDailyAction(id: string, delta: 1 | -1, day?: string): Promise<Result> {
  const { supabase, userId, action } = await ownAction(id);
  if (!action) return { ok: false, message: FAILED };
  const date = dayOrToday(day);
  const { data: row } = await supabase.from("daily_action_logs").select("id, amount").eq("action_id", id).eq("log_date", date).eq("source", "manual").gt("amount", 0).maybeSingle();
  const next = Math.max(0, ((row?.amount as number | undefined) ?? 0) + delta);
  const { error } = row
    ? next === 0
      ? await supabase.from("daily_action_logs").delete().eq("id", row.id)
      : await supabase.from("daily_action_logs").update({ amount: next }).eq("id", row.id)
    : next > 0
      ? await supabase.from("daily_action_logs").insert({ client_id: userId, action_id: id, log_date: date, amount: next })
      : { error: null };
  if (error) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}

// Minutes added by hand (a class, a walk). Its own entry, so it never
// doubles up with a timer session.
export async function addDailyMinutes(id: string, minutes: number, note?: string, day?: string): Promise<Result> {
  const { supabase, userId, action } = await ownAction(id);
  if (!action) return { ok: false, message: FAILED };
  const m = Math.round(minutes);
  if (!(m >= 1 && m <= 600)) return { ok: false, message: "Between 1 and 600 minutes." };
  const { error } = await supabase.from("daily_action_logs").insert({
    client_id: userId, action_id: id, log_date: dayOrToday(day), seconds: m * 60, source: "manual", note: note?.trim().slice(0, 1000) || null,
  });
  if (error) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}

// Take back one entry (a mistaken "add minutes").
export async function removeDailyLog(logId: string): Promise<Result> {
  const { supabase, userId } = await me();
  const { data, error } = await supabase.from("daily_action_logs").delete().eq("id", logId).eq("client_id", userId).select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}

// A current run: pause it, carry on, end it, or start a new one today.
export async function setRun(id: string, op: "pause" | "resume" | "end" | "restart"): Promise<Result> {
  const { supabase, userId, action } = await ownAction(id);
  if (!action || action.measure !== "run") return { ok: false, message: FAILED };
  const today = localDate(new Date());
  const patch =
    op === "pause" ? { run_paused: today }
    : op === "resume"
      // Carry on from where it was: the paused days don't count, and the run keeps its length.
      ? { run_started: action.run_started && action.run_paused ? addDays(action.run_started, Math.max(0, daysDiff(action.run_paused, today))) : action.run_started, run_paused: null }
      : op === "end" ? { run_ended: today, run_paused: null }
      : { run_started: today, run_paused: null, run_ended: null };
  const { error } = await supabase.from("daily_actions").update(patch).eq("id", id).eq("client_id", userId);
  if (error) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}
const daysDiff = (from: string, to: string) => (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000;

// The mindful timer: one at a time. Starting a new one when one is running
// is refused until they finish or cancel it.
export async function startTimer(actionId: string, minutes: number, intention: string): Promise<Result> {
  const { supabase, userId, action } = await ownAction(actionId);
  if (!action || action.measure !== "minutes") return { ok: false, message: FAILED };
  const m = Math.round(minutes);
  if (!(m >= 1 && m <= 180)) return { ok: false, message: "Between 1 and 180 minutes." };
  const { data: running } = await supabase.from("mindful_timers").select("client_id").eq("client_id", userId).maybeSingle();
  if (running) return { ok: false, message: "A timer is already running. Finish or cancel it first." };
  const { error } = await supabase.from("mindful_timers").insert({
    client_id: userId, action_id: actionId, planned_seconds: m * 60, intention: intention.trim().slice(0, 200) || null,
  });
  if (error) return { ok: false, message: error.code === "23505" ? "A timer is already running. Finish or cancel it first." : FAILED };
  revalidate();
  return { ok: true };
}

export async function pauseTimer(pause: boolean): Promise<Result> {
  const { supabase } = await me();
  const { error } = await supabase.rpc(pause ? "mindful_timer_pause" : "mindful_timer_resume");
  if (error) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}

// Finish and log the actual time. Returns the minutes logged, for "7 of 10".
export async function finishTimer(): Promise<{ ok: true; seconds: number; logId: string | null } | { ok: false; message: string }> {
  const { supabase } = await me();
  const { data, error } = await supabase.rpc("mindful_timer_finish", { p_date: localDate(new Date()) });
  if (error) return { ok: false, message: FAILED };
  const row = (data as { log_id: string; logged_seconds: number }[] | null)?.[0];
  revalidate();
  return { ok: true, seconds: row?.logged_seconds ?? 0, logId: row?.log_id ?? null };
}

export async function cancelTimer(): Promise<Result> {
  const { supabase, userId } = await me();
  const { error } = await supabase.from("mindful_timers").delete().eq("client_id", userId);
  if (error) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}

// A short note after a session, kept in the journal, linked to the action
// (and its area and Next Step) and to the session's log.
export async function noteOnAction(actionId: string, text: string, logId?: string | null): Promise<Result> {
  const { supabase, userId, action } = await ownAction(actionId);
  if (!action) return { ok: false, message: FAILED };
  const body = text.trim().slice(0, 20000);
  if (!body) return { ok: true };
  const { error } = await supabase.from("journal_entries").insert({
    client_id: userId, entry_date: localDate(new Date()), body, prompt: action.name.slice(0, 300),
    action_id: actionId, life_area_id: action.life_area_id, goal_id: action.goal_id,
  });
  if (error) return { ok: false, message: FAILED };
  if (logId) await supabase.from("daily_action_logs").update({ note: body.slice(0, 1000) }).eq("id", logId).eq("client_id", userId);
  revalidate();
  revalidatePath("/journal");
  return { ok: true };
}

// The daily check-in: how aligned (1–5) and, if they write anything, one
// dated journal entry for the day (updated, not duplicated, if they change it).
export async function saveCheckIn(rating: number, note: string): Promise<Result> {
  const { supabase, userId, anonymous } = await me();
  if (anonymous) return { ok: false, message: "Save your work to a free account first." };
  if (!(Number.isInteger(rating) && rating >= 1 && rating <= 5)) return { ok: false, message: "Choose how aligned you feel, 1 to 5." };
  const today = localDate(new Date());
  const body = note.trim().slice(0, 20000);
  const { data: existing } = await supabase.from("daily_checkins").select("id, journal_entry_id").eq("client_id", userId).eq("checkin_date", today).maybeSingle();
  const prompt = `Daily check-in · ${rating} of 5 aligned`;
  let entryId = (existing?.journal_entry_id as string | null | undefined) ?? null;
  if (body) {
    if (entryId) {
      const { error } = await supabase.from("journal_entries").update({ body, prompt }).eq("id", entryId).eq("client_id", userId);
      if (error) return { ok: false, message: FAILED };
    } else {
      const { data, error } = await supabase.from("journal_entries").insert({ client_id: userId, entry_date: today, body, prompt }).select("id").single();
      if (error) return { ok: false, message: FAILED };
      entryId = data.id as string;
    }
  } else if (entryId) {
    await supabase.from("journal_entries").delete().eq("id", entryId).eq("client_id", userId);
    entryId = null;
  }
  const { error } = existing
    ? await supabase.from("daily_checkins").update({ rating, journal_entry_id: entryId }).eq("id", existing.id)
    : await supabase.from("daily_checkins").insert({ client_id: userId, checkin_date: today, rating, journal_entry_id: entryId });
  if (error) return { ok: false, message: error.code === "42P01" ? NOT_READY : FAILED };
  revalidate();
  revalidatePath("/journal");
  return { ok: true };
}

// For the coach's view of a client: the daily actions they've chosen to
// share (not private), with this week's evidence. The database only returns
// shared ones to a coach (migration 0034); empty before it's run.
export async function getSharedDaily(clientId: string): Promise<{ id: string; name: string; happened: string; plan: string | null; area: string | null }[]> {
  const { supabase } = await me();
  const today = localDate(new Date());
  const week = weekStartOf(today);
  const [{ data: actions, error }, { data: logs }, { data: areas }] = await Promise.all([
    supabase.from("daily_actions").select("*").eq("client_id", clientId).eq("private", false).in("status", ["active", "paused"]).order("position"),
    supabase.from("daily_action_logs").select("id, action_id, log_date, tick, amount, seconds, source, note").eq("client_id", clientId).gte("log_date", week).lte("log_date", today),
    supabase.from("life_areas").select("id, name"),
  ]);
  if (error) return [];
  const areaName = new Map((areas ?? []).map((a) => [a.id as string, a.name as string]));
  return ((actions ?? []) as DailyAction[]).map((a) => {
    const e = weekEvidence({ ...a, days: a.days ?? [] }, (logs ?? []) as ActionLog[], week, today);
    return { id: a.id, name: a.name, happened: e.happened, plan: e.plan, area: a.life_area_id ? areaName.get(a.life_area_id) ?? null : null };
  });
}

// Their daily actions by name, for the journal's filter and labels (archived
// ones too, since old notes can be about them). Empty before 0034.
export async function getMyActionNames(): Promise<{ id: string; name: string }[]> {
  const { supabase, userId } = await me();
  const { data, error } = await supabase.from("daily_actions").select("id, name").eq("client_id", userId).order("name");
  return error ? [] : ((data ?? []) as { id: string; name: string }[]);
}
