import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { MemberCoaching } from "@/lib/actions/member-coaching";
import type { MyBilling } from "@/lib/actions/billing";
import type { Package } from "@/lib/actions/packages";
import { stripeStatus } from "@/lib/stripe";
import { cleanAreas, type CalibratedArea } from "@/lib/calibration";
import type { Goal } from "@/lib/actions/clear";
import { isSet, weekDays, type WeekDay } from "@/lib/next-step";
import { weekStartOf } from "@/lib/planning";
import { localDate } from "@/lib/time";
import { actionsForToday, countProgress, moveLog, movesForToday, type LogDay, type MoveTick, type TodayAction, type TodayMove } from "@/lib/daily-log";

// What a member sees of their coaching and billing, loaded for one client.
// Used by the member's own pages and by the console's "See as client"
// preview, so the two can't drift apart. The filters here repeat the
// member's database rules (published summaries, steps meant for them,
// issued invoices), because staff reading the same tables can see more.

type Db = Awaited<ReturnType<typeof createClient>>;
const NO_CREDITS = { balance: 0, reserved: 0, available: 0 };

export async function loadCoaching(supabase: Db, clientId: string, opts: { drafts: boolean }): Promise<MemberCoaching> {
  const empty: MemberCoaching = { available: false, sessions: [], summaries: [], commitments: [], updates: [], drafts: [], shares: [] };
  const [sessions, summaries, commitments, updates, drafts, shares] = await Promise.all([
    supabase.from("coaching_sessions").select("id, scheduled_at, timezone, duration_minutes, state, location").eq("client_id", clientId).order("scheduled_at", { ascending: false }),
    supabase.from("session_summaries").select("id, session_id, revision, content, published_at").eq("client_id", clientId).eq("status", "published").order("published_at", { ascending: false }),
    supabase.from("session_commitments").select("id, summary_id, session_id, owner, body, due_date, status, goal_id").eq("client_id", clientId).eq("visible_to_client", true).order("position"),
    supabase.from("commitment_updates").select("id, commitment_id, progress, note, support_requested, created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
    // Unshared preparation is private to the member, so only they load it.
    opts.drafts ? supabase.from("prep_drafts").select("id, session_id, content, updated_at").eq("client_id", clientId) : Promise.resolve({ data: [] }),
    // Session preparation only: a shared journal entry, review or question
    // (migration 0035) is its own thing.
    supabase.from("prep_shares").select("*").eq("client_id", clientId).order("shared_at", { ascending: false }),
  ]);
  if (sessions.error) return empty;
  return {
    available: true,
    sessions: (sessions.data ?? []) as MemberCoaching["sessions"],
    summaries: (summaries.data ?? []) as MemberCoaching["summaries"],
    commitments: (commitments.data ?? []) as MemberCoaching["commitments"],
    updates: (updates.data ?? []) as MemberCoaching["updates"],
    drafts: (drafts.data ?? []) as MemberCoaching["drafts"],
    shares: ((shares.data ?? []) as (MemberCoaching["shares"][number] & { kind?: string })[]).filter((x) => (x.kind ?? "prep") === "prep"),
  };
}

export async function loadBilling(supabase: Db, clientId: string): Promise<MyBilling> {
  const empty: MyBilling = { available: false, invoices: [], credits: NO_CREDITS, cardPayments: false };
  const [{ data: invoices, error }, { data: pos }, { data: notices }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, status, number, issue_date, due_date, total_pence, pdf_status, payment_instructions, credits_purchased, void_reason")
      .eq("client_id", clientId)
      .neq("status", "draft")
      .order("sequence", { ascending: false }),
    supabase.rpc("credit_position", { p_client: clientId }),
    supabase.from("payment_notices").select("invoice_id, status").eq("client_id", clientId),
  ]);
  if (error) return empty;
  const rows = await Promise.all(
    (invoices ?? []).map(async (inv) => {
      const { data } = await supabase.rpc("invoice_position", { p_invoice: inv.id });
      const p = ((Array.isArray(data) ? data[0] : data) ?? { paid: 0, credited: 0, balance: inv.total_pence }) as { paid: number; credited: number; balance: number };
      return {
        ...(inv as MyBilling["invoices"][number]),
        paid_pence: p.paid,
        credited_pence: p.credited,
        balance_pence: Math.max(p.balance, 0),
        noticeSent: (notices ?? []).some((n) => n.invoice_id === inv.id && n.status === "new"),
      };
    })
  );
  return {
    available: true,
    invoices: rows,
    credits: (Array.isArray(pos) ? pos[0] : pos) ?? NO_CREDITS,
    cardPayments: stripeStatus().ready,
  };
}

// Packages on offer to this client right now, decided by the same database
// rule the member's own page uses.
export async function loadOfferedPackages(supabase: Db, clientId: string, columns: string): Promise<Package[]> {
  const { data, error } = await supabase.from("packages").select(columns).order("position").order("price_pence");
  if (error) return [];
  const all = (data ?? []) as unknown as Package[];
  const open = await Promise.all(all.map((p) => supabase.rpc("_package_open", { p_package: p.id, p_client: clientId })));
  return all.filter((_, i) => open[i].data === true);
}

export type GoalCard = { id: string; title: string; area: string | null; now: number | null; target: number | null; main: boolean };

// The member's active goals for the coaching dashboard: each with its area,
// where it is now (last monthly review, else the audit it was planned from)
// and the score they're aiming for.
export async function loadGoalCards(supabase: Db, clientId: string): Promise<GoalCard[]> {
  const { data: goals } = await supabase
    .from("goals")
    .select("id, goal_title, goal_type, clear_plan_id, created_at, start_score, aim_score")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (!goals?.length) return [];
  const planIds = goals.map((g) => g.clear_plan_id).filter(Boolean) as string[];
  const [{ data: plans }, { data: checks }, { data: areas }] = await Promise.all([
    planIds.length ? supabase.from("clear_plans").select("id, audit_id, life_area_id, step_up_target").in("id", planIds) : Promise.resolve({ data: [] }),
    supabase.from("goal_checkins").select("goal_id, kind, area_score, created_at").eq("client_id", clientId).neq("kind", "weekly").order("created_at", { ascending: false }),
    supabase.from("life_areas").select("id, name"),
  ]);
  const auditIds = [...new Set((plans ?? []).map((p) => p.audit_id).filter(Boolean))] as string[];
  const { data: responses } = auditIds.length
    ? await supabase.from("audit_responses").select("audit_id, life_area_id, satisfaction_score").in("audit_id", auditIds)
    : { data: [] };
  const mainId = (goals.find((g) => g.goal_type === "primary") ?? goals[0]).id;
  return goals.map((g) => {
    const plan = (plans ?? []).find((p) => p.id === g.clear_plan_id) ?? null;
    const last = (checks ?? []).find((c) => c.goal_id === g.id && typeof c.area_score === "number");
    const base = plan ? (responses ?? []).find((r) => r.audit_id === plan.audit_id && r.life_area_id === plan.life_area_id) : null;
    const now = (last?.area_score as number | undefined) ?? (g.start_score as number | null) ?? (base?.satisfaction_score as number | undefined) ?? null;
    return {
      id: g.id as string,
      title: (g.goal_title as string | null)?.trim() || "Your goal",
      area: (areas ?? []).find((a) => a.id === plan?.life_area_id)?.name ?? null,
      now,
      // The score they think their Next Step could take them to (no fixed +1).
      target: (g.aim_score as number | null) ?? (plan?.step_up_target as number | null | undefined) ?? null,
      main: g.id === mainId,
    };
  });
}

// Their most recent calibrated chart ("Take your chart further"), only once
// their coach has shared it, with area names.
export async function loadCalibratedChart(supabase: Db, clientId: string): Promise<{ sharedAt: string; areas: (CalibratedArea & { name: string })[] } | null> {
  const [{ data, error }, { data: areas }] = await Promise.all([
    supabase.from("chart_calibrations").select("areas, shared_at").eq("client_id", clientId).eq("status", "shared").order("shared_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("life_areas").select("id, name").order("sort_order"),
  ]);
  if (error || !data) return null;
  const names = new Map((areas ?? []).map((a) => [a.id as string, a.name as string]));
  return {
    sharedAt: data.shared_at as string,
    areas: cleanAreas(data.areas, [...names.keys()]).map((a) => ({ ...a, name: names.get(a.life_area_id) ?? "" })),
  };
}

// The Next Step (migration 0029): a member's Next Steps under way and taken,
// with their moves, their 10 for the area and their weekly check-ins. The
// member's page and the console's preview both use this.
export type Move = { id: string; goal_id: string; position: number; body: string; when_text: string | null; due_date: string | null; done_at: string | null };
export type NextStepCard = {
  goal: Goal;
  area: string;
  planId: string | null;
  moves: Move[];
  set: boolean;
  ten: string | null;
  lastCloser: string | null;
  checkIns: { created_at: string }[];
  // This week, Monday first: the days they ticked off their Next Step's
  // action (in Today on My Space, or on the card).
  week: WeekDay[];
  // Each move's week (the daily log), by move id.
  moveWeeks: Record<string, LogDay[]>;
  // "Done when", counted: "3 of 8 · Spin class".
  count: { done: number; target: number; move: string } | null;
};

export async function loadNextSteps(supabase: Db, clientId: string): Promise<{ active: NextStepCard[]; taken: NextStepCard[] }> {
  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("client_id", clientId)
    .or("status.eq.active,taken_at.not.is.null")
    .order("created_at", { ascending: false });
  const list = (goals ?? []) as Goal[];
  const ids = list.map((g) => g.id);
  const planIds = [...new Set(list.map((g) => g.clear_plan_id).filter((x): x is string => !!x))];
  const today = localDate(new Date());
  const weekStart = weekStartOf(today);
  const sets = list.map((g) => g.set_at).filter((x): x is string => !!x).map((x) => localDate(x));
  const since = [weekStart, ...sets].sort()[0];
  const [{ data: moves }, { data: plans }, { data: areas }, { data: checkIns }, { data: ticks }] = await Promise.all([
    ids.length ? supabase.from("goal_moves").select("*").in("goal_id", ids).order("position").order("created_at") : Promise.resolve({ data: [] }),
    planIds.length ? supabase.from("clear_plans").select("id, life_area_id, life_vision").in("id", planIds) : Promise.resolve({ data: [] }),
    supabase.from("life_areas").select("id, name"),
    ids.length
      ? supabase.from("goal_checkins").select("goal_id, closer, created_at").in("goal_id", ids).eq("kind", "weekly").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("plan_actions").select("goal_id, move_id, action_date, source, done_at").in("goal_id", ids).in("source", ["plan", "move"]).not("done_at", "is", null).gte("action_date", since)
      : Promise.resolve({ data: [] }),
  ]);
  const ticked = (ticks ?? []) as (MoveTick & { goal_id: string; source: string })[];
  const allMoves = (moves ?? []) as Move[];
  const areaName = new Map((areas ?? []).map((a) => [a.id as string, a.name as string]));
  const planArea = new Map((plans ?? []).map((p) => [p.id as string, areaName.get(p.life_area_id as string) ?? null]));
  const ten = new Map((plans ?? []).map((p) => [p.id as string, ((p.life_vision as string | null) ?? "").trim() || null]));
  const weekly = (checkIns ?? []) as { goal_id: string; closer: string | null; created_at: string }[];
  const day = (iso: string) => localDate(iso);
  const cards: NextStepCard[] = list.map((g) => {
    const own = allMoves.filter((m) => m.goal_id === g.id);
    const goalTicks = ticked.filter((t) => t.goal_id === g.id);
    // A day counts on the week when anything for this Next Step was ticked,
    // and when a one-off move was done.
    const weekDates = [
      ...goalTicks.filter((t) => t.action_date >= weekStart).map((t) => t.action_date),
      ...own.filter((m) => m.done_at).map((m) => day(m.done_at!)).filter((d) => d >= weekStart),
    ];
    const counted = countProgress(g, goalTicks, g.set_at ? day(g.set_at) : null);
    const countMove = own.find((m) => m.id === g.count_move_id);
    return {
      goal: g,
      area: (g.clear_plan_id && planArea.get(g.clear_plan_id)) || g.focus_area?.trim() || "Your Next Step",
      planId: g.clear_plan_id,
      moves: own,
      set: isSet(g),
      ten: (g.clear_plan_id && ten.get(g.clear_plan_id)) || null,
      lastCloser: weekly.find((c) => c.goal_id === g.id)?.closer ?? null,
      checkIns: weekly.filter((c) => c.goal_id === g.id),
      week: weekDays(weekStart, weekDates, today),
      moveWeeks: Object.fromEntries(own.map((m) => [m.id, moveLog(m, goalTicks, weekStart, 7, today, day)])),
      count: counted && countMove ? { ...counted, move: countMove.body } : null,
    };
  });
  return {
    // The main one first, then newest.
    active: cards
      .filter((c) => c.goal.status === "active" && !c.goal.taken_at)
      .sort((a, b) => Number(b.goal.goal_type === "primary") - Number(a.goal.goal_type === "primary")),
    taken: cards.filter((c) => !!c.goal.taken_at),
  };
}

// Today on My Space, the daily log: every move due today from their Next
// Steps under way, and their session actions linked to one or due.
export async function loadToday(supabase: Db, clientId: string, coaching: MemberCoaching | null): Promise<{ moves: (TodayMove & { step: string })[]; actions: TodayAction[]; available: boolean; total: number }> {
  const today = localDate(new Date());
  const { data: goals } = await supabase.from("goals").select("id, goal_title, step_name, set_at, frequency, success_criteria, status, taken_at").eq("client_id", clientId).eq("status", "active").is("taken_at", null);
  const active = ((goals ?? []) as Goal[]).filter((g) => isSet(g));
  const ids = active.map((g) => g.id);
  const [{ data: moves }, ticks] = await Promise.all([
    ids.length ? supabase.from("goal_moves").select("*").in("goal_id", ids).order("position").order("created_at") : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("plan_actions").select("move_id, action_date, done_at").eq("client_id", clientId).eq("source", "move").eq("action_date", today)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const day = (iso: string) => localDate(iso);
  const stepOf = new Map(active.map((g) => [g.id, (g.step_name?.trim() || g.goal_title?.trim() || "Your Next Step")]));
  const due = movesForToday((moves ?? []) as Move[], (ticks.data ?? []) as MoveTick[], today, day).map((m) => ({ ...m, step: stepOf.get(m.goalId) ?? "" }));
  const actions = coaching?.available ? actionsForToday(coaching.commitments, coaching.updates, ids, today, day) : [];
  return { moves: due, actions, available: !ticks.error, total: (moves ?? []).length };
}
