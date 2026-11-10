"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClearPlan, Goal } from "@/lib/actions/clear";
import type { LifeArea } from "@/lib/actions/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL, sendEmail } from "@/lib/email";
import { renderEmail, renderText, type Block } from "@/lib/email-layout";
import { stepName } from "@/lib/next-step";

// The Next Step: reads and writes. A Next Step is a goals row on a plan
// (clear_plans) for one audit and one area. The plan holds the area-level
// answers (what's going on, the 10); the goal holds the Next Step itself;
// goal_moves hold the moves. Migration 0029.

type Db = Awaited<ReturnType<typeof createClient>>;
import { loadNextSteps, type Move } from "@/lib/member-view";
export type { Move } from "@/lib/member-view";
export type Result = { ok: true } | { ok: false; message: string };
const FAILED = "Couldn’t save — check your connection and try again.";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

const clean = (v: unknown, max = 2000) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};
const score = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
};

function revalidate() {
  revalidatePath("/");
  revalidatePath("/next-step");
}

// The area's score to start from: the agreed score where the chart has been
// taken further with a coach (the agreed score is the new baseline),
// otherwise the score they gave in the Protocol.
async function startingScore(supabase: Db, userId: string, plan: Pick<ClearPlan, "audit_id" | "life_area_id">) {
  if (!plan.audit_id || !plan.life_area_id) return { score: null as number | null, note: null as string | null };
  const [{ data: response }, { data: calibration }] = await Promise.all([
    supabase.from("audit_responses").select("satisfaction_score, note").eq("audit_id", plan.audit_id).eq("life_area_id", plan.life_area_id).maybeSingle(),
    supabase
      .from("chart_calibrations")
      .select("areas")
      .eq("client_id", userId)
      .eq("audit_id", plan.audit_id)
      .eq("status", "shared")
      .order("shared_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const agreed = Array.isArray(calibration?.areas)
    ? (calibration.areas as { life_area_id?: string; agreed?: unknown }[]).find((a) => a.life_area_id === plan.life_area_id)?.agreed
    : null;
  return {
    score: score(agreed) ?? score(response?.satisfaction_score),
    note: clean(response?.note),
  };
}

// Start (or carry on with) a Next Step in an area, from their latest
// Protocol. One plan per audit and area; reopening an area finds the same one.
export async function openNextStep(areaId: string) {
  const { supabase, userId } = await me();
  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("client_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!audit) redirect("/next-step");
  const { data: existing } = await supabase
    .from("clear_plans")
    .select("id")
    .eq("client_id", userId)
    .eq("audit_id", audit.id)
    .eq("life_area_id", areaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let planId = existing?.id as string | undefined;
  if (!planId) {
    const { data: created, error } = await supabase
      .from("clear_plans")
      .insert({ client_id: userId, audit_id: audit.id, life_area_id: areaId })
      .select("id")
      .single();
    if (error) throw error;
    planId = created.id as string;
  }
  redirect(`/next-step/build?plan=${planId}`);
}

export type BuildContext = {
  plan: ClearPlan;
  area: LifeArea;
  score: number | null;
  auditNote: string | null;
  // The Next Step being set on this plan (null before screen 3).
  goal: Goal | null;
  moves: Move[];
  // Emotional Wellbeing scored 3 or lower: point gently to support.
  lowWellbeing: boolean;
};

// Everything the five screens need. The goal is the plan's latest one while
// it's still active and not taken; once a Next Step is taken, the next one
// on the same plan starts fresh.
export async function getBuildContext(planId: string): Promise<BuildContext | null> {
  const { supabase, userId } = await me();
  const { data: plan } = await supabase.from("clear_plans").select("*").eq("id", planId).eq("client_id", userId).maybeSingle();
  if (!plan?.life_area_id) return null;
  const [{ data: area }, { data: goal }, start, { data: wellbeing }] = await Promise.all([
    supabase.from("life_areas").select("*").eq("id", plan.life_area_id).maybeSingle(),
    supabase.from("goals").select("*").eq("clear_plan_id", planId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    startingScore(supabase, userId, plan as ClearPlan),
    plan.audit_id
      ? supabase.from("audit_responses").select("satisfaction_score, life_areas!inner(name)").eq("audit_id", plan.audit_id).eq("life_areas.name", "Emotional Wellbeing").maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!area) return null;
  const current = goal && goal.status === "active" && !goal.taken_at ? (goal as Goal) : null;
  // After a Next Step is taken, the next one here starts from the new score.
  const takenScore = !current && goal?.taken_at ? score(goal.taken_score) : null;
  const { data: moves } = current
    ? await supabase.from("goal_moves").select("*").eq("goal_id", current.id).order("position").order("created_at")
    : { data: [] };
  return {
    plan: plan as ClearPlan,
    area: area as LifeArea,
    score: current?.start_score ?? takenScore ?? start.score,
    auditNote: start.note,
    goal: current,
    moves: (moves ?? []) as Move[],
    lowWellbeing: typeof wellbeing?.satisfaction_score === "number" && wellbeing.satisfaction_score <= 3,
  };
}

export type ScreenInput =
  | { screen: 1; now: string }
  | { screen: 2; ten: string }
  | { screen: 3; title: string; name?: string; aim: number; why: string; feel: string; checks: Record<string, boolean> }
  | { screen: 4; inTheWay: string; spill: string }
  | { screen: 5; moves: { id?: string; body: string; when: string }[]; done: string };

// Save one screen. Screens 1–2 write to the plan; screen 3 creates the Next
// Step (the goal) the first time; 4–5 write to it and its moves.
export async function saveScreen(planId: string, input: ScreenInput): Promise<Result> {
  const { supabase, userId } = await me();
  const { data: plan } = await supabase.from("clear_plans").select("*").eq("id", planId).eq("client_id", userId).maybeSingle();
  if (!plan?.life_area_id) return { ok: false, message: FAILED };

  if (input.screen === 1 || input.screen === 2) {
    const fields = input.screen === 1 ? { current_reality: clean(input.now) } : { life_vision: clean(input.ten) };
    const { data, error } = await supabase.from("clear_plans").update(fields).eq("id", planId).select("id");
    if (error || !data?.length) return { ok: false, message: FAILED };
    revalidate();
    return { ok: true };
  }

  const ctx = await getBuildContext(planId);
  if (!ctx) return { ok: false, message: FAILED };

  if (input.screen === 3) {
    const title = clean(input.title, 200);
    const why = clean(input.why);
    const aim = score(input.aim);
    if (!title) return { ok: false, message: "Say what your Next Step is." };
    if (!aim) return { ok: false, message: "Mark how far you think it could take you." };
    if (!why) return { ok: false, message: "Say why this one." };
    const checks = Object.fromEntries(
      ["different", "reach", "visible"].filter((k) => k in (input.checks ?? {})).map((k) => [k, !!input.checks[k]])
    );
    const fields = {
      goal_title: title,
      step_name: clean(input.name, 80),
      aim_score: aim,
      motivation_text: why,
      feel_text: clean(input.feel),
      step_checks: checks,
    };
    if (ctx.goal) {
      const { data, error } = await supabase.from("goals").update(fields).eq("id", ctx.goal.id).select("id");
      if (error || !data?.length) return { ok: false, message: FAILED };
    } else {
      const { data: main } = await supabase
        .from("goals")
        .select("id")
        .eq("client_id", userId)
        .eq("status", "active")
        .eq("goal_type", "primary")
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from("goals").insert({
        client_id: userId,
        clear_plan_id: planId,
        focus_area: ctx.area.name,
        goal_type: main ? "supporting" : "primary",
        start_score: ctx.score,
        ...fields,
      });
      if (error) return { ok: false, message: FAILED };
    }
    await supabase.from("clear_plans").update({ why_it_matters: why }).eq("id", planId);
    revalidate();
    return { ok: true };
  }

  if (!ctx.goal) return { ok: false, message: "Set your Next Step first." };
  const goalId = ctx.goal.id;

  if (input.screen === 4) {
    const inTheWay = clean(input.inTheWay);
    if (!inTheWay) return { ok: false, message: "Say what’s in the way of it." };
    const { data, error } = await supabase
      .from("goals")
      .update({ in_the_way: inTheWay, spill_over: clean(input.spill) })
      .eq("id", goalId)
      .select("id");
    if (error || !data?.length) return { ok: false, message: FAILED };
    revalidate();
    return { ok: true };
  }

  // Screen 5: the moves (kept in the order given) and how they'll know.
  const moves = (input.moves ?? [])
    .map((m) => ({ id: m.id, body: clean(m.body, 200), when: clean(m.when, 120) }))
    .filter((m): m is { id: string | undefined; body: string; when: string | null } => !!m.body)
    .slice(0, 20);
  const done = clean(input.done);
  if (!moves.length) return { ok: false, message: "Add at least one move." };
  if (!done) return { ok: false, message: "Say how you’ll know it’s taken." };
  const keep = new Set(moves.map((m) => m.id).filter(Boolean));
  const gone = ctx.moves.filter((m) => !keep.has(m.id)).map((m) => m.id);
  if (gone.length) {
    const { error } = await supabase.from("goal_moves").delete().in("id", gone);
    if (error) return { ok: false, message: FAILED };
  }
  for (const [position, m] of moves.entries()) {
    const row = { body: m.body, when_text: m.when, position };
    const { error } = m.id && ctx.moves.some((x) => x.id === m.id)
      ? await supabase.from("goal_moves").update(row).eq("id", m.id)
      : await supabase.from("goal_moves").insert({ ...row, client_id: userId, goal_id: goalId });
    if (error) return { ok: false, message: FAILED };
  }
  const { data, error } = await supabase.from("goals").update({ success_criteria: done }).eq("id", goalId).select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}

// "Take this step": the Next Step is set.
export async function takeOnNextStep(planId: string): Promise<Result> {
  const ctx = await getBuildContext(planId);
  if (!ctx?.goal || !ctx.moves.length || !ctx.goal.success_criteria?.trim()) return { ok: false, message: "Finish the five screens first." };
  const { supabase } = await me();
  // Set again before its first check-in (a rewrite, or an old My Plan goal
  // made into a Next Step): it starts today, so the first check-in is a week
  // from now rather than due straight away.
  let restart = !ctx.goal.set_at;
  if (!restart) {
    const { count } = await supabase.from("goal_checkins").select("id", { count: "exact", head: true }).eq("goal_id", ctx.goal.id);
    restart = !count;
  }
  if (restart) {
    const { data, error } = await supabase.from("goals").update({ set_at: new Date().toISOString() }).eq("id", ctx.goal.id).select("id");
    if (error || !data?.length) return { ok: false, message: FAILED };
  }
  revalidate();
  return { ok: true };
}

export type { NextStepCard } from "@/lib/member-view";

// The member's Next Steps: under way (set or still being set) and taken.
export async function getMyNextSteps() {
  const { supabase, userId } = await me();
  return loadNextSteps(supabase, userId);
}

export async function setMoveDone(moveId: string, done: boolean): Promise<Result> {
  const { supabase } = await me();
  const { data, error } = await supabase
    .from("goal_moves")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", moveId)
    .select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}

// The weekly check-in: is it closer? Ticking moves happens in place
// (setMoveDone); this records the answer and what moved it.
export async function saveCheckIn(input: { goalId: string; closer: "closer" | "same" | "further"; note: string }): Promise<Result> {
  const { supabase, userId } = await me();
  if (!["closer", "same", "further"].includes(input.closer)) return { ok: false, message: "Choose closer, about the same or further away." };
  const { error } = await supabase.from("goal_checkins").insert({
    client_id: userId,
    goal_id: input.goalId,
    kind: "weekly",
    closer: input.closer,
    helped: clean(input.note),
  });
  if (error) return { ok: false, message: FAILED };
  revalidate();
  return { ok: true };
}

// "It's taken": score the area again and say what changed. The Next Step is
// then complete; the re-score is also recorded as a review with the area's
// score, so My Journey shows it like the monthly reviews before it.
export async function markTaken(input: { goalId: string; score: number; changed: string }): Promise<Result> {
  const { supabase, userId } = await me();
  const s = score(input.score);
  if (!s) return { ok: false, message: "Score the area as it is today." };
  const changed = clean(input.changed);
  const { data, error } = await supabase
    .from("goals")
    .update({ taken_score: s, taken_at: new Date().toISOString(), what_changed: changed, status: "completed" })
    .eq("id", input.goalId)
    .eq("client_id", userId)
    .is("taken_at", null)
    .select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  await supabase.from("goal_checkins").insert({
    client_id: userId,
    goal_id: input.goalId,
    kind: "monthly",
    area_score: s,
    next_step: "done",
    helped: changed,
  });
  revalidate();
  return { ok: true };
}

export type GoalContext = { goal: Goal; area: string; areaId: string | null; planId: string | null; moves: Move[]; lastCloser: string | null };

// One of their own Next Steps, for the check-in and taken pages.
export async function getNextStep(goalId: string): Promise<GoalContext | null> {
  const { supabase, userId } = await me();
  const { data: goal } = await supabase.from("goals").select("*").eq("id", goalId).eq("client_id", userId).maybeSingle();
  if (!goal) return null;
  const [{ data: plan }, { data: moves }, { data: last }] = await Promise.all([
    goal.clear_plan_id ? supabase.from("clear_plans").select("life_area_id").eq("id", goal.clear_plan_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("goal_moves").select("*").eq("goal_id", goalId).order("position").order("created_at"),
    supabase.from("goal_checkins").select("closer").eq("goal_id", goalId).eq("kind", "weekly").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const areaId = (plan?.life_area_id as string | undefined) ?? null;
  const { data: area } = areaId ? await supabase.from("life_areas").select("name").eq("id", areaId).maybeSingle() : { data: null };
  return {
    goal: goal as Goal,
    area: (area?.name as string | undefined) ?? goal.focus_area?.trim() ?? "Your Next Step",
    areaId,
    planId: goal.clear_plan_id,
    moves: (moves ?? []) as Move[],
    lastCloser: (last?.closer as string | null | undefined) ?? null,
  };
}

// One Next Step's moves (My Space shows the first one not yet done).
export async function getMovesForGoal(goalId: string): Promise<Move[]> {
  const { supabase } = await me();
  const { data } = await supabase.from("goal_moves").select("*").eq("goal_id", goalId).order("position").order("created_at");
  return (data ?? []) as Move[];
}

// "Share with your coach" on the set page: emails their coach that the Next
// Step is set, with a link to their record, and notes when it was shared.
// The coach could already see it; this puts it in front of them before the
// next session. Only the area and the step's name go in the email.
export async function shareWithCoach(goalId: string): Promise<Result> {
  const { supabase, userId } = await me();
  const [{ data: goal }, { data: profile }] = await Promise.all([
    supabase.from("goals").select("id, goal_title, step_name, focus_area").eq("id", goalId).eq("client_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name, coach_id").eq("id", userId).maybeSingle(),
  ]);
  if (!goal) return { ok: false, message: FAILED };
  if (!profile?.coach_id) return { ok: false, message: "You don’t have a coach yet." };
  type Coach = { email: string | null; full_name: string | null };
  let coach: Coach | null = null;
  try {
    const { data } = await createAdminClient().from("profiles").select("email, full_name").eq("id", profile.coach_id).maybeSingle();
    coach = (data as Coach | null) ?? null;
  } catch {
    // No service key here: can't look the coach up.
  }
  if (!coach?.email) return { ok: false, message: "Couldn’t reach your coach just now. Try again later." };
  const member = (profile.full_name as string | null)?.trim() || "Your client";
  const first = member.split(/\s+/)[0];
  const area = (goal.focus_area as string | null)?.trim() || "one area";
  const heading = `${first} has set a Next Step`;
  const blocks: Block[] = [
    { p: `${member} has set a Next Step in ${area}, and wanted you to see it before your next session.` },
    { quote: stepName(goal as { step_name: string | null; goal_title: string }) },
    { button: { href: `${SITE_URL}/coach/clients/${userId}`, label: "Open their record" } },
  ];
  const sent = await sendEmail({
    to: coach.email,
    subject: heading,
    html: renderEmail({ preheader: `${member}: a new Next Step in ${area}`, heading, blocks }),
    text: renderText({ heading, blocks }),
  });
  if (!sent.ok) return { ok: false, message: "Couldn’t send just now. Try again in a moment." };
  await supabase.from("goals").update({ shared_with_coach_at: new Date().toISOString() }).eq("id", goalId).eq("client_id", userId);
  revalidatePath("/next-step/set");
  return { ok: true };
}
