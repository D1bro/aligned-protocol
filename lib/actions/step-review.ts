"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/actions/admin";
import { readStepReview } from "@/lib/ai-step-review";
import { SITE_URL, sendEmail } from "@/lib/email";
import { renderEmail, renderText, type Block } from "@/lib/email-layout";
import type { ReviewContent } from "@/lib/next-step-review";

// The coach's side of the Next Step review (migration 0032): the sharper
// version agreed in a session, saved as a draft and sent to the member to
// keep; the AI read for the coach alone; and closing older session actions.

type Result = { ok: true } | { ok: false; message: string };
const FAILED = "Couldn’t save — try again.";

export type StepReview = { id: string; goalId: string; content: ReviewContent; sentAt: string | null; answer: string | null; answeredAt: string | null; updatedAt: string };

const toReview = (r: Record<string, unknown>): StepReview => ({
  id: r.id as string,
  goalId: r.goal_id as string,
  content: (r.content as ReviewContent) ?? {},
  sentAt: (r.sent_at as string | null) ?? null,
  answer: (r.answer as string | null) ?? null,
  answeredAt: (r.answered_at as string | null) ?? null,
  updatedAt: r.updated_at as string,
});

// The review in hand for a Next Step (a draft, or sent and not yet
// answered), else the last one answered. Null before migration 0032.
export async function getStepReview(goalId: string): Promise<StepReview | null> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("next_step_reviews").select("*").eq("goal_id", goalId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return toReview(data);
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function tidy(c: ReviewContent): ReviewContent {
  const moves = (c.moves ?? [])
    .map((m) => ({ ...(m.id ? { id: String(m.id) } : {}), body: text(m.body, 200), when: text(m.when, 120) }))
    .filter((m) => m.body)
    .slice(0, 20);
  const aim = Math.round(Number(c.aim));
  const target = Math.round(Number(c.countTarget));
  const countMove = Number(c.countMove);
  return {
    why: text(c.why, 2000),
    title: text(c.title, 200),
    name: text(c.name, 80),
    done: text(c.done, 2000),
    aim: aim >= 1 && aim <= 10 ? aim : null,
    countTarget: target >= 1 && target <= 365 ? target : null,
    countMove: Number.isInteger(countMove) && moves[countMove] ? countMove : null,
    moves,
    note: text(c.note, 1000),
    ...(c.ai ? { ai: c.ai } : {}),
  };
}

// Save the agreed version as a draft (the member doesn't see it yet).
export async function saveStepReview(input: { goalId: string; clientId: string; content: ReviewContent }): Promise<Result> {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: open } = await supabase.from("next_step_reviews").select("id, content, sent_at").eq("goal_id", input.goalId).is("answered_at", null).maybeSingle();
  if (open?.sent_at) return { ok: false, message: "This has been sent. Wait for their answer, or take it back first." };
  const content = tidy({ ...input.content, ai: (open?.content as ReviewContent | undefined)?.ai });
  const { error } = open
    ? await supabase.from("next_step_reviews").update({ content, author_id: me.id }).eq("id", open.id)
    : await supabase.from("next_step_reviews").insert({ goal_id: input.goalId, client_id: input.clientId, author_id: me.id, content });
  if (error) return { ok: false, message: FAILED };
  revalidatePath(`/coach/clients/${input.clientId}`, "layout");
  return { ok: true };
}

// Send it to the member to keep: it shows on their Next Step and My Space,
// and they get an email saying it's there (the words stay in the app).
export async function sendStepReview(input: { goalId: string; clientId: string; content: ReviewContent }): Promise<Result> {
  const saved = await saveStepReview(input);
  if (!saved.ok) return saved;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("next_step_reviews")
    .update({ sent_at: new Date().toISOString() })
    .eq("goal_id", input.goalId)
    .is("answered_at", null)
    .is("sent_at", null)
    .select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  const [{ data: client }, me] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", input.clientId).maybeSingle(),
    requireStaff(),
  ]);
  if (client?.email) {
    const first = (client.full_name as string | null)?.trim().split(/\s+/)[0] || "there";
    const coach = me.full_name?.trim().split(/\s+/)[0] || "Your coach";
    const heading = "Your Next Step, sharpened";
    const blocks: Block[] = [
      { p: `Hi ${first},` },
      { p: `${coach} has written up the sharper version of your Next Step from your session. Have a look: keep it, or change the words so they’re yours.` },
      { button: { href: `${SITE_URL}/next-step`, label: "See it on The Next Step" } },
    ];
    await sendEmail({ to: client.email as string, subject: heading, html: renderEmail({ preheader: "From your session: your Next Step, sharpened", heading, blocks }), text: renderText({ heading, blocks }) });
  }
  revalidatePath(`/coach/clients/${input.clientId}`, "layout");
  return { ok: true };
}

// Take a sent review back (before they've answered), to change it.
export async function unsendStepReview(input: { goalId: string; clientId: string }): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("next_step_reviews").update({ sent_at: null }).eq("goal_id", input.goalId).is("answered_at", null).select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  revalidatePath(`/coach/clients/${input.clientId}`, "layout");
  return { ok: true };
}

// The AI read: the Next Step against the shared summaries and the coach's
// own notes, for the coach alone. Kept with the draft.
export async function runStepReviewRead(input: { goalId: string; clientId: string }): Promise<Result> {
  const me = await requireStaff();
  const supabase = await createClient();
  const [{ data: goal }, { data: moves }, { data: summaries }, { data: notes }, { data: client }] = await Promise.all([
    supabase.from("goals").select("*").eq("id", input.goalId).eq("client_id", input.clientId).maybeSingle(),
    supabase.from("goal_moves").select("body, when_text").eq("goal_id", input.goalId).order("position"),
    supabase.from("session_summaries").select("content, published_at").eq("client_id", input.clientId).eq("status", "published").order("published_at", { ascending: false }).limit(3),
    supabase.from("coach_notes").select("body, updated_at").eq("client_id", input.clientId).eq("author_id", me.id).order("updated_at", { ascending: false }).limit(3),
    supabase.from("profiles").select("full_name").eq("id", input.clientId).maybeSingle(),
  ]);
  if (!goal) return { ok: false, message: FAILED };
  const g = goal as Record<string, unknown>;
  const s = (k: string) => (typeof g[k] === "string" ? (g[k] as string).trim() : "");
  const nextStep = [
    `Step: ${s("goal_title")}`,
    s("step_name") ? `Its name: ${s("step_name")}` : "",
    `Why: ${s("motivation_text")}`,
    s("feel_text") ? `How it will feel: ${s("feel_text")}` : "",
    `Score now: ${g.start_score ?? "?"}; aiming for: ${g.aim_score ?? "?"} (out of 10)`,
    `Done when: ${s("success_criteria")}${g.count_target ? ` (counted: ${g.count_target} ticks)` : ""}`,
    `In the way: ${s("in_the_way")}`,
    s("spill_over") ? `How it spills over: ${s("spill_over")}` : "",
    `Moves:\n${(moves ?? []).map((m) => `- ${m.body}${m.when_text ? ` (${m.when_text})` : ""}`).join("\n")}`,
  ].filter(Boolean).join("\n");
  const sessions = (summaries ?? [])
    .map((x) => {
      const c = (x.content ?? {}) as { summary?: string; insights?: string[] };
      return `Session shared ${String(x.published_at).slice(0, 10)}:\n${c.summary ?? ""}\nInsights: ${(c.insights ?? []).join("; ")}`;
    })
    .join("\n\n");
  const coachNotes = (notes ?? []).map((n) => String(n.body).slice(0, 3000)).join("\n\n");
  const res = await readStepReview({
    clientFirstName: (client?.full_name as string | null)?.trim().split(/\s+/)[0] || "the client",
    area: s("focus_area") || "their area",
    nextStep,
    sessions,
    coachNotes,
  });
  if (!res.ok) return res;
  const ai = { ...res.read, at: new Date().toISOString() };
  const { data: open } = await supabase.from("next_step_reviews").select("id, content").eq("goal_id", input.goalId).is("answered_at", null).maybeSingle();
  const { error } = open
    ? await supabase.from("next_step_reviews").update({ content: { ...((open.content as ReviewContent) ?? {}), ai } }).eq("id", open.id)
    : await supabase.from("next_step_reviews").insert({ goal_id: input.goalId, client_id: input.clientId, author_id: me.id, content: { ai } });
  if (error) return { ok: false, message: FAILED };
  revalidatePath(`/coach/clients/${input.clientId}`, "layout");
  return { ok: true };
}

// An older session action, closed by the coach: done, or let go.
export async function closeSessionAction(input: { commitmentId: string; clientId: string; status: "done" | "dropped" | "open" }): Promise<Result> {
  await requireStaff();
  if (!["done", "dropped", "open"].includes(input.status)) return { ok: false, message: FAILED };
  const supabase = await createClient();
  const { data, error } = await supabase.from("session_commitments").update({ status: input.status }).eq("id", input.commitmentId).eq("client_id", input.clientId).select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  revalidatePath(`/coach/clients/${input.clientId}`, "layout");
  revalidatePath("/");
  revalidatePath("/coaching");
  return { ok: true };
}
