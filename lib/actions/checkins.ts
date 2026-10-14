"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

export async function getCheckIns(goalId: string): Promise<CheckIn[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goal_checkins")
    .select("*")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });
  return (data as CheckIn[]) ?? [];
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

// Save a monthly check-in, then go where their "what next" choice leads:
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
  if (error) return { ok: false, message: "Couldn’t save your check-in — check your connection and try again." };

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
        message: "Your check-in is saved, but the goal couldn’t be marked done. Use “Mark as done” on My plan.",
      };
    }
  }
  revalidatePath("/clear");
  revalidatePath("/");
  redirect(input.nextStep === "adjust" ? "/clear?edit=4" : "/clear");
}

// Every check-in they've done, newest first — for My journey.
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
  return (data as CheckIn[]) ?? [];
}
