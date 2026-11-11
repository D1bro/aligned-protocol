"use server";

// Choosing exactly what a coach sees (release 2 of the Daily Alignment brief,
// 11 Nov 2026): one journal entry, one weekly review, or one question for
// coaching. Sharing copies the words into prep_shares (where shared session
// preparation already goes, migration 0035), so the coach never reads the
// journal itself; taking it back deletes the copy. The coach gets a short
// email that something's been shared, with a link, never the words.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL, sendEmail } from "@/lib/email";
import { renderEmail, renderText, type Block } from "@/lib/email-layout";

type Result = { ok: true } | { ok: false; message: string };
export type ShareKind = "entry" | "review" | "question";
const FAILED = "Couldn’t share just now. Try again in a moment.";
const KIND_WORDS: Record<ShareKind, string> = { entry: "a journal entry", review: "their weekly review", question: "a question for coaching" };

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");
  return { supabase, userId: user.id };
}

const dayLabel = (ymd: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${ymd}T12:00:00Z`));

// Share one entry, one review (by id) or a question (its text).
export async function shareToCoach(input: { kind: ShareKind; id?: string; text?: string }): Promise<Result> {
  const { supabase, userId } = await me();
  const { data: profile } = await supabase.from("profiles").select("full_name, coach_id").eq("id", userId).maybeSingle();
  if (!profile?.coach_id) return { ok: false, message: "You don’t have a coach yet." };

  let title: string;
  let content: string;
  let sourceId: string | null = null;
  if (input.kind === "entry") {
    const { data } = input.id ? await supabase.from("journal_entries").select("id, entry_date, prompt, body").eq("id", input.id).eq("client_id", userId).maybeSingle() : { data: null };
    if (!data) return { ok: false, message: FAILED };
    title = [data.prompt?.trim(), dayLabel(data.entry_date as string)].filter(Boolean).join(" · ").slice(0, 200);
    content = (data.body as string).slice(0, 10_000);
    sourceId = data.id as string;
  } else if (input.kind === "review") {
    const { data } = input.id ? await supabase.from("daily_reviews").select("id, week_start, journal_entry_id").eq("id", input.id).eq("client_id", userId).maybeSingle() : { data: null };
    if (!data) return { ok: false, message: FAILED };
    const { data: entry } = data.journal_entry_id ? await supabase.from("journal_entries").select("body").eq("id", data.journal_entry_id).maybeSingle() : { data: null };
    const body = (entry?.body as string | undefined)?.trim();
    if (!body) return { ok: false, message: "Write something in the review first." };
    title = `Weekly review · week of ${dayLabel(data.week_start as string).replace(/^\w+ /, "")}`;
    content = body.slice(0, 10_000);
    sourceId = data.id as string;
  } else if (input.kind === "question") {
    content = (input.text ?? "").trim().slice(0, 2000);
    if (!content) return { ok: false, message: "Write your question first." };
    title = "A question for coaching";
  } else {
    return { ok: false, message: FAILED };
  }

  const { error } = await supabase.from("prep_shares").insert({ client_id: userId, session_id: null, kind: input.kind, source_id: sourceId, title, content });
  if (error) return { ok: false, message: error.code === "23505" ? "You’ve already shared this." : error.code === "42703" ? "Sharing isn’t switched on yet (database update 0035)." : FAILED };
  await tellCoach(profile.coach_id as string, userId, (profile.full_name as string | null) ?? null, input.kind);
  for (const path of ["/journal", "/daily", "/daily/review"]) revalidatePath(path);
  return { ok: true };
}

// Take a share back: the coach's copy is deleted.
export async function stopSharing(shareId: string): Promise<Result> {
  const { supabase, userId } = await me();
  const { data, error } = await supabase.from("prep_shares").delete().eq("id", shareId).eq("client_id", userId).neq("kind", "prep").select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn’t stop sharing just now. Try again." };
  for (const path of ["/journal", "/daily", "/daily/review"]) revalidatePath(path);
  return { ok: true };
}

// What they've shared: journal entries and reviews by their id, and the
// questions they've asked. Empty before database update 0035.
export async function getMyShares(): Promise<{ hasCoach: boolean; bySource: Record<string, string>; questions: { id: string; text: string; sharedAt: string }[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { hasCoach: false, bySource: {}, questions: [] };
  const userId = user.id;
  const [{ data: profile }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("coach_id").eq("id", userId).maybeSingle(),
    supabase.from("prep_shares").select("id, kind, source_id, content, shared_at").eq("client_id", userId).neq("kind", "prep").order("shared_at", { ascending: false }).limit(200),
  ]);
  const rows = error ? [] : ((data ?? []) as { id: string; kind: string; source_id: string | null; content: string; shared_at: string }[]);
  return {
    hasCoach: !!profile?.coach_id,
    bySource: Object.fromEntries(rows.filter((r) => r.source_id).map((r) => [r.source_id!, r.id])),
    questions: rows.filter((r) => r.kind === "question").slice(0, 5).map((r) => ({ id: r.id, text: r.content, sharedAt: r.shared_at })),
  };
}

// A short email to the coach: who shared what kind of thing, and a link.
async function tellCoach(coachId: string, userId: string, fullName: string | null, kind: ShareKind) {
  try {
    const { data: coach } = await createAdminClient().from("profiles").select("email").eq("id", coachId).maybeSingle();
    if (!coach?.email) return;
    const member = fullName?.trim() || "Your client";
    const first = member.split(/\s+/)[0];
    const heading = `${first} shared ${KIND_WORDS[kind]} with you`;
    const blocks: Block[] = [
      { p: `${member} has shared ${KIND_WORDS[kind]} with you. It's in their record, under Overview.` },
      { button: { href: `${SITE_URL}/coach/clients/${userId}`, label: "Open their record" } },
    ];
    await sendEmail({ to: coach.email as string, subject: heading, html: renderEmail({ preheader: heading, heading, blocks }), text: renderText({ heading, blocks }) });
  } catch {
    // The share is saved either way; the email is a nudge.
  }
}
