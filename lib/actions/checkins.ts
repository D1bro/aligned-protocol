"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// A monthly review (the goal check-in: did they do it, the area's score,
// what next). Weekly reviews share the table (kind 'weekly', migration 0021)
// and are read separately, so everything that charts scores only ever sees
// monthly ones.
export type CheckIn = {
  id: string;
  goal_id: string;
  did_it: "not_yet" | "sometimes" | "most" | "every";
  area_score: number;
  helped: string | null;
  got_in_way: string | null;
  next_step: "keep" | "adjust" | "done";
  created_at: string;
};

export type WeeklyReview = {
  id: string;
  goal_id: string;
  kind: "weekly";
  did_it: "done" | "partly" | "missed";
  helped: string | null;
  next_step: "keep" | "smaller" | "change";
  next_commitment: string | null;
  created_at: string;
};

const isWeekly = (r: { kind?: string | null }) => r.kind === "weekly";

export async function getCheckIns(goalId: string): Promise<CheckIn[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goal_checkins")
    .select("*")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as (CheckIn & { kind?: string })[]).filter((c) => !isWeekly(c));
}

// Every review on a goal, weekly and monthly, oldest first: what the weekly
// rhythm (lib/review-schedule.ts) counts from.
export async function getReviews(goalId: string): Promise<{ weekly: WeeklyReview[]; all: { created_at: string; kind: string }[] }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goal_checkins")
    .select("*")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as { kind?: string | null; created_at: string }[];
  return {
    weekly: rows.filter(isWeekly) as unknown as WeeklyReview[],
    all: rows.map((r) => ({ created_at: r.created_at, kind: r.kind ?? "monthly" })),
  };
}

// The weekly review: what happened, what helped or got in the way, and what
// they're committing to next. Monthly reviews go through saveCheckIn.
export async function saveWeeklyReview(input: {
  goalId: string;
  didIt: WeeklyReview["did_it"];
  helped: string;
  nextStep: WeeklyReview["next_step"];
  nextCommitment: string;
}): Promise<{ ok: false; message: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const commitment = input.nextCommitment.trim().slice(0, 600);
  if (!commitment) return { ok: false, message: "Say what you’re committing to next week." };
  const { error } = await supabase.from("goal_checkins").insert({
    client_id: user.id,
    goal_id: input.goalId,
    kind: "weekly",
    did_it: input.didIt,
    area_score: null,
    helped: input.helped.trim().slice(0, 600) || null,
    next_step: input.nextStep,
    next_commitment: commitment,
  });
  if (error) return { ok: false, message: "Couldn’t save your review — check your connection and try again." };
  revalidatePath("/");
  revalidatePath("/clear");
  redirect("/?reviewed=1");
}

// Every goal they’ve set, newest first — for My plan’s goal list and My journey.
export async function getAllGoals() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("goals")
    .select("id, goal_title, goal_type, focus_area, status, created_at, updated_at")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// Save a monthly review (the goal check-in), then go where their "what next" choice leads:
// keep going -> My plan; adjust -> CLEAR's action step; done -> goal closed.
export async function saveCheckIn(input: {
  goalId: string;
  didIt: CheckIn["did_it"];
  areaScore: number;
  helped: string;
  gotInWay: string;
  nextStep: CheckIn["next_step"];
}): Promise<{ ok: false; message: string; saved?: boolean } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!Number.isInteger(input.areaScore) || input.areaScore < 1 || input.areaScore > 10) {
    return { ok: false, message: "Choose where this area is now, from 1 to 10." };
  }
  const { error } = await supabase.from("goal_checkins").insert({
    client_id: user.id,
    goal_id: input.goalId,
    did_it: input.didIt,
    area_score: input.areaScore,
    helped: input.helped.trim() || null,
    got_in_way: input.gotInWay.trim() || null,
    next_step: input.nextStep,
  });
  if (error) return { ok: false, message: "Couldn’t save your monthly review — check your connection and try again." };

  if (input.nextStep === "done") {
    // The check-in is already saved, so on failure say so plainly rather than
    // inviting a resubmit that would record a duplicate check-in.
    const { data: closed, error: closeErr } = await supabase
      .from("goals")
      .update({ status: "completed" })
      .eq("id", input.goalId)
      .select("id");
    if (closeErr || !closed?.length) {
      revalidatePath("/clear");
      return {
        ok: false,
        saved: true,
        message: "Your monthly review is saved, but the goal couldn’t be marked done. Use “Mark as done” on My plan.",
      };
    }
  }
  revalidatePath("/clear");
  revalidatePath("/");
  redirect(input.nextStep === "adjust" ? "/clear?edit=4" : "/?reviewed=1");
}

// Every monthly review they've done, newest first — for My journey.
export async function getAllCheckIns(): Promise<CheckIn[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("goal_checkins")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });
  return ((data ?? []) as (CheckIn & { kind?: string })[]).filter((c) => !isWeekly(c));
}
