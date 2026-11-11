"use server";

// The Daily Alignment's weekly review (release 2 of Duane's build brief v1,
// 11 Nov 2026): prepared from what was actually logged that week, then five
// questions. Private, like the journal (migration 0035). Its "is it closer?"
// also counts as the Next Step's weekly check-in, the answer only, so there's
// one weekly rhythm rather than two.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";
import { addDays } from "@/lib/daily-log";
import { loadNextSteps } from "@/lib/member-view";
import { stepName } from "@/lib/next-step";
import { nextReview } from "@/lib/review-schedule";
import {
  type ActionLog, type DailyAction, type Evidence, minutesOf, reviewDue, reviewText, reviewWeek, weekEvidence, weekOf,
} from "@/lib/daily-alignment";

type Supabase = Awaited<ReturnType<typeof createClient>>;
const FAILED = "Couldn’t save. Your answers are still here. Check your connection and try again.";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id, anonymous: !!user.is_anonymous };
}

export type ReviewChoice = { actionId: string; name: string; choice: "keep" | "smaller" | "pause"; target: number | null };
export type SavedReview = {
  id: string;
  week_start: string;
  goal_id: string | null;
  moved: string | null;
  helped: string | null;
  in_way: string | null;
  closer: "closer" | "same" | "further" | null;
  decision: "keep" | "smaller" | "change" | null;
  choices: ReviewChoice[];
  journal_entry_id: string | null;
};

export type ReviewStep = {
  id: string;
  title: string;
  area: string;
  inTheWay: string | null;
  doneWhen: string | null;
  count: { done: number; target: number; move: string } | null;
  // Moves ticked off that week: "Spin class · 2 days".
  moves: { name: string; days: number }[];
  editHref: string | null;
};

export type WeeklyReviewData = {
  available: boolean;
  today: string;
  week: string;
  weekEnd: string;
  isThisWeek: boolean;
  prevWeek: string;
  nextWeek: string | null;
  actions: (Evidence & { measure: DailyAction["measure"]; target: number | null; period: DailyAction["period"]; status: DailyAction["status"]; unit: string | null })[];
  mindful: { minutes: number; sessions: number };
  checkIns: { date: string; rating: number }[];
  notes: { id: string; date: string; prompt: string | null; text: string }[];
  step: ReviewStep | null;
  // What got in the way last time they reviewed, if they said.
  lastInWay: string | null;
  review: SavedReview | null;
  hasCoach: boolean;
  sharedId: string | null;
};

// The week of `day` (or the week due a review), prepared from its records.
export async function getWeeklyReview(day?: string | null): Promise<WeeklyReviewData> {
  const { supabase, userId } = await me();
  const today = localDate(new Date());
  const reviewed = await supabase.from("daily_reviews").select("week_start").eq("client_id", userId).order("week_start", { ascending: false }).limit(12);
  const week = day ? weekOf(day, today) : reviewWeek(today, ((reviewed.data ?? []) as { week_start: string }[]).map((r) => r.week_start));
  const weekEnd = addDays(week, 6);
  const until = weekEnd < today ? weekEnd : today;
  const thisWeek = weekOf(today, today);
  const base = {
    today, week, weekEnd, isThisWeek: week === thisWeek, prevWeek: addDays(week, -7), nextWeek: week < thisWeek ? addDays(week, 7) : null,
  };
  if (reviewed.error) {
    return { ...base, available: false, actions: [], mindful: { minutes: 0, sessions: 0 }, checkIns: [], notes: [], step: null, lastInWay: null, review: null, hasCoach: false, sharedId: null };
  }

  const [actions, logs, checkIns, notes, row, last, profile, steps] = await Promise.all([
    supabase.from("daily_actions").select("*").eq("client_id", userId).lte("start_date", weekEnd).order("position").order("created_at"),
    supabase.from("daily_action_logs").select("id, action_id, log_date, tick, amount, seconds, source, note").eq("client_id", userId).gte("log_date", week).lte("log_date", until),
    supabase.from("daily_checkins").select("checkin_date, rating").eq("client_id", userId).gte("checkin_date", week).lte("checkin_date", until).order("checkin_date"),
    supabase.from("journal_entries").select("id, entry_date, prompt, body").eq("client_id", userId).gte("entry_date", week).lte("entry_date", until).order("entry_date").limit(30),
    supabase.from("daily_reviews").select("*").eq("client_id", userId).eq("week_start", week).maybeSingle(),
    supabase.from("daily_reviews").select("in_way").eq("client_id", userId).lt("week_start", week).not("in_way", "is", null).order("week_start", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("coach_id").eq("id", userId).maybeSingle(),
    loadNextSteps(supabase, userId),
  ]);

  const allLogs = (logs.data ?? []) as ActionLog[];
  const all = ((actions.data ?? []) as DailyAction[]).map((a) => ({ ...a, days: a.days ?? [] }));
  // The actions that were part of that week: still on the go, or logged in it.
  const loggedIds = new Set(allLogs.map((l) => l.action_id));
  const inWeek = all.filter((a) => loggedIds.has(a.id) || (a.status === "active" && (!a.end_date || a.end_date >= week)));
  const mindfulIds = new Set(all.filter((a) => a.mindful && a.measure === "minutes").map((a) => a.id));
  const mindfulLogs = allLogs.filter((l) => mindfulIds.has(l.action_id) && l.seconds > 0);

  const review = (row.data as (SavedReview & { choices: ReviewChoice[] | null }) | null) ?? null;
  const card = steps.active[0] ?? null;
  const step = card && card.set ? await stepEvidence(supabase, card, week, until) : null;
  const shared = review
    ? await supabase.from("prep_shares").select("id").eq("client_id", userId).eq("kind", "review").eq("source_id", review.id).maybeSingle()
    : null;

  return {
    ...base,
    available: true,
    actions: inWeek.map((a) => ({ ...weekEvidence(a, allLogs, week, today), measure: a.measure, target: a.target, period: a.period, status: a.status, unit: a.unit })),
    mindful: { minutes: minutesOf(mindfulLogs.reduce((s, l) => s + l.seconds, 0)), sessions: mindfulLogs.length },
    checkIns: ((checkIns.data ?? []) as { checkin_date: string; rating: number }[]).map((c) => ({ date: c.checkin_date, rating: c.rating })),
    notes: ((notes.data ?? []) as { id: string; entry_date: string; prompt: string | null; body: string }[])
      .filter((n) => n.id !== review?.journal_entry_id)
      .map((n) => ({ id: n.id, date: n.entry_date, prompt: n.prompt, text: n.body.trim().split("\n")[0].slice(0, 160) })),
    step,
    lastInWay: (last.data?.in_way as string | undefined)?.trim() || null,
    review: review ? { ...review, choices: review.choices ?? [] } : null,
    hasCoach: !!profile.data?.coach_id,
    sharedId: (shared?.data?.id as string | undefined) ?? null,
  };
}

type Card = Awaited<ReturnType<typeof loadNextSteps>>["active"][number];

// The Next Step that week: its moves ticked off, the "done when" count, and
// what they said was in the way.
async function stepEvidence(supabase: Supabase, card: Card, week: string, until: string): Promise<ReviewStep> {
  const [{ data: ticks }] = await Promise.all([
    supabase.from("plan_actions").select("move_id, action_date").eq("goal_id", card.goal.id).in("source", ["plan", "move"]).not("done_at", "is", null).gte("action_date", week).lte("action_date", until),
  ]);
  const days = new Map<string, Set<string>>();
  for (const t of (ticks ?? []) as { move_id: string | null; action_date: string }[]) {
    if (!t.move_id) continue;
    if (!days.has(t.move_id)) days.set(t.move_id, new Set());
    days.get(t.move_id)!.add(t.action_date);
  }
  for (const m of card.moves) {
    const d = m.done_at ? localDate(m.done_at) : null;
    if (d && d >= week && d <= until) {
      if (!days.has(m.id)) days.set(m.id, new Set());
      days.get(m.id)!.add(d);
    }
  }
  return {
    id: card.goal.id,
    title: stepName(card.goal),
    area: card.area,
    inTheWay: card.goal.in_the_way?.trim() || null,
    doneWhen: card.goal.success_criteria?.trim() || null,
    count: card.count,
    moves: card.moves.map((m) => ({ name: m.body, days: days.get(m.id)?.size ?? 0 })),
    editHref: card.planId ? `/next-step/build?plan=${card.planId}&step=5` : null,
  };
}

// When the next weekly review is, for Today: the Next Step's next check-in
// if there's one, otherwise Sunday. Done if this week (or, early in the
// week, last week) is reviewed.
export async function getReviewDue(): Promise<{ date: string; due: boolean; done: boolean; week: string } | null> {
  const { supabase, userId } = await me();
  const today = localDate(new Date());
  const [{ data, error }, steps] = await Promise.all([
    supabase.from("daily_reviews").select("week_start").eq("client_id", userId).order("week_start", { ascending: false }).limit(2),
    loadNextSteps(supabase, userId),
  ]);
  if (error) return null;
  const weeks = ((data ?? []) as { week_start: string }[]).map((r) => r.week_start);
  const week = reviewWeek(today, weeks);
  const card = steps.active[0];
  const next = card?.set ? nextReview({ start: card.goal.set_at ?? card.goal.created_at ?? today, actionWhen: null, reviews: card.checkIns, monthly: false }).date : null;
  return { ...reviewDue(today, next), done: weeks.includes(week), week };
}

export type ReviewInput = {
  week: string;
  goalId: string | null;
  moved: string;
  helped: string;
  inWay: string;
  closer: SavedReview["closer"];
  decision: SavedReview["decision"];
  choices: { actionId: string; choice: ReviewChoice["choice"]; target: number | null }[];
};

const clean = (s: string) => s.trim().slice(0, 2000) || null;
const weekLabel = (week: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${week}T12:00:00Z`));

// Save the week's review. Saving again updates it (and its journal entry and
// check-in) rather than adding another. The choices for each action take
// effect now: a smaller target, or paused for now. Repeating actions carry
// on into next week without being set up again.
export async function saveWeeklyReview(input: ReviewInput): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { supabase, userId, anonymous } = await me();
  if (anonymous) return { ok: false, message: "Save your work to a free account first." };
  const today = localDate(new Date());
  const week = weekOf(input.week, today);
  if (week !== input.week) return { ok: false, message: "Choose this week or an earlier one." };
  if (input.closer && !["closer", "same", "further"].includes(input.closer)) return { ok: false, message: FAILED };
  if (input.decision && !["keep", "smaller", "change"].includes(input.decision)) return { ok: false, message: FAILED };
  const moved = clean(input.moved);
  const helped = clean(input.helped);
  const inWay = clean(input.inWay);
  const weekEnd = addDays(week, 6);
  const until = weekEnd < today ? weekEnd : today;

  const [{ data: actionRows }, { data: logRows }, { data: existing }, { data: goal }] = await Promise.all([
    supabase.from("daily_actions").select("*").eq("client_id", userId),
    supabase.from("daily_action_logs").select("id, action_id, log_date, tick, amount, seconds, source, note").eq("client_id", userId).gte("log_date", week).lte("log_date", until),
    supabase.from("daily_reviews").select("id, journal_entry_id, checkin_id").eq("client_id", userId).eq("week_start", week).maybeSingle(),
    input.goalId ? supabase.from("goals").select("id, goal_title, step_name, clear_plan_id").eq("id", input.goalId).eq("client_id", userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const actions = ((actionRows ?? []) as DailyAction[]).map((a) => ({ ...a, days: a.days ?? [] }));
  const byId = new Map(actions.map((a) => [a.id, a]));
  const choices: ReviewChoice[] = [];
  for (const c of input.choices) {
    const a = byId.get(c.actionId);
    if (!a || !["keep", "smaller", "pause"].includes(c.choice)) continue;
    const target = c.choice === "smaller" && c.target && a.target && c.target >= 1 && c.target < a.target ? Math.round(c.target) : null;
    choices.push({ actionId: a.id, name: a.name, choice: c.choice === "smaller" && !target ? "keep" : c.choice, target });
  }
  if (!moved && !helped && !inWay && !input.closer && !input.decision && !choices.some((c) => c.choice !== "keep")) {
    return { ok: false, message: "Answer at least one question first." };
  }

  // The choices take effect now.
  for (const c of choices) {
    if (c.choice === "smaller" && c.target) {
      const { error } = await supabase.from("daily_actions").update({ target: c.target }).eq("id", c.actionId).eq("client_id", userId);
      if (error) return { ok: false, message: FAILED };
    } else if (c.choice === "pause" && byId.get(c.actionId)?.status === "active") {
      const { error } = await supabase.from("daily_actions").update({ status: "paused" }).eq("id", c.actionId).eq("client_id", userId);
      if (error) return { ok: false, message: FAILED };
    }
  }

  const stepTitle = goal ? stepName(goal as { step_name: string | null; goal_title: string }) : null;
  const text = reviewText({ moved, helped, in_way: inWay, closer: goal ? input.closer : null, decision: goal ? input.decision : null, stepTitle, choices });

  // The journal entry: the review in words, dated the last day of that week
  // (or today, for this week).
  const { data: plan } = goal?.clear_plan_id ? await supabase.from("clear_plans").select("life_area_id").eq("id", goal.clear_plan_id).maybeSingle() : { data: null };
  let entryId = (existing?.journal_entry_id as string | null | undefined) ?? null;
  const entry = { entry_date: until, prompt: `Weekly review · week of ${weekLabel(week)}`, body: text, goal_id: goal?.id ?? null, life_area_id: (plan?.life_area_id as string | undefined) ?? null };
  if (text) {
    if (entryId) {
      const { error } = await supabase.from("journal_entries").update(entry).eq("id", entryId).eq("client_id", userId);
      if (error) return { ok: false, message: FAILED };
    } else {
      const { data, error } = await supabase.from("journal_entries").insert({ ...entry, client_id: userId }).select("id").single();
      if (error) return { ok: false, message: FAILED };
      entryId = data.id as string;
    }
  }

  // The Next Step's weekly check-in: the answer only (the words stay private).
  // Only for this week or last; an older week's review is a look back.
  let checkinId = (existing?.checkin_id as string | null | undefined) ?? null;
  if (goal && input.closer && week >= addDays(weekOf(today, today), -7)) {
    if (checkinId) {
      await supabase.from("goal_checkins").update({ closer: input.closer, next_step: input.decision }).eq("id", checkinId).eq("client_id", userId);
    } else {
      const { data } = await supabase.from("goal_checkins").insert({ client_id: userId, goal_id: goal.id, kind: "weekly", closer: input.closer, next_step: input.decision }).select("id").single();
      checkinId = (data?.id as string | undefined) ?? null;
    }
  }

  const evidence = actions
    .filter((a) => a.status !== "archived" || (logRows ?? []).some((l) => l.action_id === a.id))
    .map((a) => weekEvidence(a, (logRows ?? []) as ActionLog[], week, today))
    .map((e) => ({ name: e.name, plan: e.plan, happened: e.happened }));
  const row = {
    client_id: userId, week_start: week, goal_id: goal?.id ?? null, moved, helped, in_way: inWay,
    closer: goal ? input.closer : null, decision: goal ? input.decision : null, evidence, choices, journal_entry_id: entryId, checkin_id: checkinId,
  };
  const { data: saved, error } = existing
    ? await supabase.from("daily_reviews").update(row).eq("id", existing.id).select("id").single()
    : await supabase.from("daily_reviews").insert(row).select("id").single();
  if (error || !saved) return { ok: false, message: error?.code === "42P01" ? "The weekly review isn’t switched on yet (database update 0035)." : FAILED };

  // If they'd shared this review, the coach's copy follows the change.
  if (text) await supabase.from("prep_shares").update({ content: text }).eq("client_id", userId).eq("kind", "review").eq("source_id", saved.id);

  for (const path of ["/daily", "/daily/review", "/journal", "/next-step", "/"]) revalidatePath(path);
  return { ok: true, id: saved.id as string };
}
