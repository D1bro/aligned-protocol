"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";
import { addMonths, checkBirthDate, isMonthColour, monthDate, parseYm, type MonthColour } from "@/lib/life-months";

// 1,000 Months (migration 0024): the optional date of birth and month
// reflections, private to the member, and the story of any month drawn from
// what they've already saved. `available` is false until 0024 has run.

type Result = { ok: true } | { ok: false; message: string };
const failed = (message = "Couldn’t save just now — try again."): Result => ({ ok: false, message });
export type MonthReflection = { month: string; colour: MonthColour | null; reflection: string | null };

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && !user.is_anonymous ? { supabase, userId: user.id } : null;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/journey", "layout");
  revalidatePath("/details");
}

export async function getBirthDate(): Promise<{ available: boolean; birthDate: string | null }> {
  const m = await signedIn();
  if (!m) return { available: false, birthDate: null };
  const { data, error } = await m.supabase.from("life_details").select("birth_date").eq("client_id", m.userId).maybeSingle();
  if (error) return { available: false, birthDate: null };
  return { available: true, birthDate: (data?.birth_date as string | null) ?? null };
}

export async function saveBirthDate(value: string): Promise<Result> {
  const m = await signedIn();
  if (!m) return failed();
  const checked = checkBirthDate(value, localDate(new Date()));
  if (!checked.ok) return failed(checked.message);
  const { error } = checked.value
    ? await m.supabase.from("life_details").upsert({ client_id: m.userId, birth_date: checked.value }, { onConflict: "client_id" })
    : await m.supabase.from("life_details").delete().eq("client_id", m.userId);
  if (error) return failed();
  refresh();
  return { ok: true };
}

// Every month they've reflected on, keyed "YYYY-MM".
export async function getMonthReflections(): Promise<{ available: boolean; months: Record<string, MonthReflection> }> {
  const m = await signedIn();
  if (!m) return { available: false, months: {} };
  const { data, error } = await m.supabase.from("month_reflections").select("month, colour, reflection").eq("client_id", m.userId);
  if (error) return { available: false, months: {} };
  const months: Record<string, MonthReflection> = {};
  for (const r of data ?? []) {
    const ym = (r.month as string).slice(0, 7);
    months[ym] = { month: ym, colour: isMonthColour(r.colour) ? r.colour : null, reflection: (r.reflection as string | null) ?? null };
  }
  return { available: true, months };
}

// Reflect on a month that has started (not the future). Choosing nothing and
// writing nothing clears it.
export async function saveMonthReflection(input: { month: string; colour: string | null; reflection: string }): Promise<Result> {
  const m = await signedIn();
  if (!m) return failed();
  const ym = parseYm(input.month);
  if (!ym || ym > localDate(new Date()).slice(0, 7)) return failed("You can reflect on a month once it has begun.");
  const colour = input.colour && isMonthColour(input.colour) ? input.colour : null;
  const reflection = input.reflection.trim().slice(0, 1000) || null;
  const { error } =
    colour || reflection
      ? await m.supabase.from("month_reflections").upsert(
          { client_id: m.userId, month: monthDate(ym), colour, reflection },
          { onConflict: "client_id,month" }
        )
      : await m.supabase.from("month_reflections").delete().eq("client_id", m.userId).eq("month", monthDate(ym));
  if (error) return failed();
  refresh();
  return { ok: true };
}

export type MonthStory = {
  intention: string | null;
  actions: { done: number; total: number };
  weeklyReviews: number;
  monthlyReviews: number;
  audits: { id: string; date: string; score: number | null }[];
  goalsSet: string[];
  goalsDone: string[];
  journal: { available: boolean; entries: { id: string; date: string; opening: string }[] };
};

// What happened in a month, from what they've already saved. Nothing new is
// stored and nothing is judged. The journal is included only where they can
// read it (lib/actions/journal.ts).
export async function getMonthStory(ym: string): Promise<MonthStory | null> {
  const m = await signedIn();
  if (!m) return null;
  const from = monthDate(ym);
  const to = monthDate(addMonths(ym, 1));
  const { supabase, userId } = m;
  const [intention, actions, reviews, audits, goals, journal] = await Promise.all([
    supabase.from("monthly_intentions").select("intention").eq("client_id", userId).eq("month", from).maybeSingle(),
    supabase.from("plan_actions").select("done_at").eq("client_id", userId).gte("action_date", from).lt("action_date", to),
    supabase.from("goal_checkins").select("kind, did_it, next_step").eq("client_id", userId).gte("created_at", from).lt("created_at", to),
    supabase.from("audits").select("id, completed_at, total_score").eq("client_id", userId).eq("status", "completed").gte("completed_at", from).lt("completed_at", to).order("completed_at"),
    supabase.from("goals").select("goal_title, status, created_at, updated_at, set_at, taken_at").eq("client_id", userId),
    supabase.from("journal_entries").select("id, entry_date, body").eq("client_id", userId).gte("entry_date", from).lt("entry_date", to).order("entry_date"),
  ]);
  const inMonth = (iso: string | null | undefined) => !!iso && iso >= from && iso < to;
  const goalRows = (goals.data ?? []) as { goal_title: string | null; status: string; created_at: string; updated_at: string | null; set_at: string | null; taken_at: string | null }[];
  const title = (g: { goal_title: string | null }) => g.goal_title?.trim() || "A goal";
  const actionRows = (actions.data ?? []) as { done_at: string | null }[];
  const reviewRows = (reviews.data ?? []) as { kind: string | null; did_it: string | null; next_step: string | null }[];
  return {
    intention: (intention.data?.intention as string | undefined) ?? null,
    actions: { done: actionRows.filter((a) => a.done_at).length, total: actionRows.length },
    weeklyReviews: reviewRows.filter((r) => r.kind === "weekly").length,
    // Taking a Next Step is recorded with the area's new score; it shows as "Next Step taken".
    monthlyReviews: reviewRows.filter((r) => r.kind !== "weekly" && !(r.next_step === "done" && !r.did_it)).length,
    audits: ((audits.data ?? []) as { id: string; completed_at: string; total_score: number | null }[]).map((a) => ({ id: a.id, date: a.completed_at, score: a.total_score })),
    goalsSet: goalRows.filter((g) => inMonth(g.set_at ?? g.created_at)).map(title),
    goalsDone: goalRows.filter((g) => (g.taken_at ? inMonth(g.taken_at) : g.status === "completed" && inMonth(g.updated_at))).map(title),
    journal: {
      available: !journal.error,
      entries: ((journal.data ?? []) as { id: string; entry_date: string; body: string }[]).map((e) => {
        const line = e.body.trim().split("\n")[0];
        return { id: e.id, date: e.entry_date, opening: line.length > 120 ? `${line.slice(0, 120).trimEnd()}…` : line };
      }),
    },
  };
}
