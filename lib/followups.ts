import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { COACHING_ADDRESS, coachingFrom, sendEmail, SITE_URL } from "@/lib/email";
import { renderEmail, renderText } from "@/lib/email-layout";
import { isSet } from "@/lib/next-step";
import { localDate, toLocalParts } from "@/lib/time";
import {
  COPY_KEYS,
  copyKey,
  dueFollowup,
  FOLLOWUP_DAYS,
  followupEmail,
  pausedDaysSince,
  SEND_HOUR_LONDON,
  sequenceDays,
  type CopyKey,
  type DayState,
  type FollowupCopy,
  type FollowupDay,
} from "@/lib/followup-content";

// The follow-up emails after the audit, run each morning by
// /api/cron/followups. Only for people who asked for them (profiles.
// followups_email, migration 0037), and never once they've moved on: an
// enquiry, a coach, a membership or an invoice means Duane is already in
// touch, so the sequence stops for good. Each email is claimed in
// message_jobs under "followup:<client>:<day>" before it's sent, so it can
// only go once. The wording is Duane's edited version where he's saved one
// (followup_copy, 0038), and nothing goes while he has them paused.

type Admin = ReturnType<typeof createAdminClient>;
const LIVE_MEMBERSHIP = ["active", "trialing", "past_due"];

// --- Duane's wording and pauses (migration 0038) -----------------------------------

export type CopyOverrides = Partial<Record<CopyKey, FollowupCopy & { updatedAt: string }>>;

export async function loadCopy(admin: Admin): Promise<{ installed: boolean; copy: CopyOverrides }> {
  const { data, error } = await admin.from("followup_copy").select("key, subject, preheader, body, button, updated_at");
  if (error) return { installed: false, copy: {} };
  const copy: CopyOverrides = {};
  for (const r of data ?? []) {
    if ((COPY_KEYS as string[]).includes(r.key as string)) {
      copy[r.key as CopyKey] = { subject: r.subject as string, preheader: (r.preheader as string) ?? "", body: r.body as string, button: r.button as string, updatedAt: r.updated_at as string };
    }
  }
  return { installed: true, copy };
}

export type Pauses = { paused: boolean; since: string | null; spans: { from: string; to: string | null }[] };

export async function loadPauses(admin: Admin): Promise<Pauses> {
  const { data, error } = await admin.from("followup_pauses").select("started_at, ended_at").order("started_at");
  if (error) return { paused: false, since: null, spans: [] };
  const open = (data ?? []).find((r) => !r.ended_at);
  return {
    paused: !!open,
    since: (open?.started_at as string | undefined) ?? null,
    spans: (data ?? []).map((r) => ({ from: localDate(r.started_at as string), to: r.ended_at ? localDate(r.ended_at as string) : null })),
  };
}

// --- Who's where -------------------------------------------------------------

export type SequencePerson = {
  id: string;
  name: string | null;
  email: string | null;
  emailToken: string;
  asked: boolean;
  askedAt: string | null;
  remindersOn: boolean;
  start: string | null; // day 0 (London date), once they've finished an audit
  score: number | null; // latest audit
  stepId: string | null; // their set Next Step, if any
  checkinToday: boolean; // their weekly check-in email went today
  stopped: string | null; // why the sequence has stopped for good
  days: DayState[] | null;
  pausedDays: number;
};

export async function loadSequence(admin: Admin, now: Date = new Date(), pauses?: Pauses): Promise<{ ok: true; people: SequencePerson[] } | { ok: false }> {
  const today = localDate(now);
  const p = pauses ?? (await loadPauses(admin));
  const [asked, jobs] = await Promise.all([
    admin.from("profiles").select("id").eq("followups_email", true),
    admin.from("message_jobs").select("client_id, dedupe_key, status, error, created_at, sent_at").eq("kind", "followup"),
  ]);
  if (asked.error || jobs.error) return { ok: false };
  const ids = [...new Set([...(asked.data ?? []).map((r) => r.id as string), ...(jobs.data ?? []).map((r) => r.client_id as string)])];
  if (!ids.length) return { ok: true, people: [] };

  const [profiles, audits, goals, enquiries, memberships, invoices, checkins] = await Promise.all([
    admin.from("profiles").select("id, email, full_name, role, coach_id, reminders_email, followups_email, followups_at, email_token").in("id", ids),
    admin.from("audits").select("client_id, total_score, completed_at").in("client_id", ids).eq("status", "completed").order("completed_at", { ascending: true }),
    admin.from("goals").select("id, client_id, set_at, frequency, success_criteria").in("client_id", ids).eq("status", "active"),
    admin.from("coaching_enquiries").select("client_id").in("client_id", ids),
    admin.from("memberships").select("client_id").in("client_id", ids).in("status", LIVE_MEMBERSHIP),
    admin.from("invoices").select("client_id").in("client_id", ids).neq("status", "void"),
    admin.from("reminder_log").select("client_id, sent_at").in("client_id", ids).gte("sent_at", new Date(now.getTime() - 2 * 86_400_000).toISOString()),
  ]);
  if (profiles.error || audits.error || goals.error) return { ok: false };

  const has = (rows: { client_id: unknown }[] | null, id: string) => (rows ?? []).some((r) => r.client_id === id);
  const people = (profiles.data ?? []).map((pr): SequencePerson => {
    const id = pr.id as string;
    const mine = (audits.data ?? []).filter((a) => a.client_id === id);
    const step = (goals.data ?? []).find((g) => g.client_id === id && isSet(g));
    const auditDay = mine[0] ? localDate(mine[0].completed_at as string) : null;
    const optedDay = pr.followups_at ? localDate(pr.followups_at as string) : null;
    const start = auditDay ? (optedDay && optedDay > auditDay ? optedDay : auditDay) : null;
    const stopped =
      pr.role !== "client" ? "Staff account"
      : has(enquiries.data, id) ? "Sent a coaching enquiry"
      : pr.coach_id ? "Has a coach"
      : has(memberships.data, id) ? "Joined Momentum"
      : has(invoices.data, id) ? "Has an invoice"
      : !pr.followups_email ? "Turned them off"
      : null;
    const sent: Partial<Record<FollowupDay, { status: "sent" | "failed" | "queued"; date: string; reason: string | null }>> = {};
    for (const j of (jobs.data ?? []).filter((x) => x.client_id === id)) {
      const day = Number(String(j.dedupe_key).split(":")[2]) as FollowupDay;
      if (FOLLOWUP_DAYS.includes(day)) sent[day] = { status: j.status as "sent" | "failed" | "queued", date: localDate((j.sent_at ?? j.created_at) as string), reason: (j.error as string | null) ?? null };
    }
    const pausedDays = start ? pausedDaysSince(start, today, p.spans) : 0;
    return {
      id,
      name: (pr.full_name as string | null) ?? null,
      email: (pr.email as string | null) ?? null,
      emailToken: pr.email_token as string,
      asked: !!pr.followups_email,
      askedAt: (pr.followups_at as string | null) ?? null,
      remindersOn: !!pr.reminders_email,
      start,
      score: mine.length ? ((mine[mine.length - 1].total_score as number | null) ?? null) : null,
      stepId: (step?.id as string | undefined) ?? null,
      checkinToday: (checkins.data ?? []).some((r) => r.client_id === id && localDate(r.sent_at as string) === today),
      stopped,
      pausedDays,
      days: start ? sequenceDays({ start, today, pausedDays, sent, hasStep: !!step, checkinEmailOn: !!pr.reminders_email }) : null,
    };
  });
  return { ok: true, people };
}

function linksFor(person: { stepId: string | null; emailToken: string }) {
  return {
    nextStep: `${SITE_URL}/next-step`,
    checkIn: person.stepId ? `${SITE_URL}/next-step/check-in?goal=${person.stepId}` : `${SITE_URL}/next-step`,
    coaching: `${SITE_URL}/coaching`,
    stop: `${SITE_URL}/api/reminders/unsubscribe?t=${person.emailToken}&list=followups`,
  };
}

// --- The morning job -------------------------------------------------------------

export async function sendFollowups(admin: Admin, now: Date = new Date()) {
  if (Number(toLocalParts(now).time.slice(0, 2)) !== SEND_HOUR_LONDON) return { skipped: "not 9am in London" };
  const pauses = await loadPauses(admin);
  if (pauses.paused) return { skipped: "paused in the console" };
  const [seq, { copy }] = await Promise.all([loadSequence(admin, now, pauses), loadCopy(admin)]);
  if (!seq.ok) return { error: "lookup failed" };
  const today = localDate(now);

  let sent = 0;
  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] ?? 0) + 1);

  for (const p of seq.people) {
    if (p.stopped) { skip(p.stopped); continue; }
    if (!p.email) { skip("no email"); continue; }
    if (!p.start) { skip("no audit yet"); continue; }
    if (p.checkinToday) { skip("check-in email today"); continue; }
    const sentDays = (p.days ?? []).filter((d) => d.state === "sent" || d.state === "failed").map((d) => d.day as number);
    const day = dueFollowup({ start: p.start, today, sent: sentDays, hasStep: !!p.stepId, checkinEmailOn: p.remindersOn, pausedDays: p.pausedDays });
    if (!day) continue;

    const m = followupEmail({ day, firstName: p.name, score: p.score, hasStep: !!p.stepId, links: linksFor(p), copy: copy[copyKey(day, !!p.stepId)] });
    const text = renderText({ heading: m.heading, blocks: m.blocks, signature: m.signature });
    const { data: job, error: claimErr } = await admin
      .from("message_jobs")
      .insert({ client_id: p.id, kind: "followup", dedupe_key: `followup:${p.id}:${day}`, to_email: p.email, subject: m.subject, body_text: text })
      .select("id")
      .single();
    if (claimErr || !job) { skip(claimErr?.code === "23505" ? "already sent" : "couldn't log"); continue; }

    const result = await sendEmail({
      to: p.email,
      subject: m.subject,
      text,
      html: renderEmail({ preheader: m.preheader, heading: m.heading, blocks: m.blocks, signature: m.signature }),
      from: coachingFrom(m.signature.name),
      replyTo: COACHING_ADDRESS,
    });
    await admin
      .from("message_jobs")
      .update(result.ok ? { status: "sent", sent_at: new Date().toISOString(), provider_id: result.id, attempts: 1 } : { status: "failed", error: result.reason, attempts: 1 })
      .eq("id", job.id);
    if (result.ok) sent += 1;
    else skip(result.reason);
  }
  return { checked: seq.people.length, sent, skipped };
}

// --- Previews to Duane's own inbox -------------------------------------------------

const PREVIEW_LINKS = {
  nextStep: `${SITE_URL}/next-step`,
  checkIn: `${SITE_URL}/next-step`,
  coaching: `${SITE_URL}/coaching`,
  stop: `${SITE_URL}/api/reminders/unsubscribe?t=preview&list=followups`,
};

// One email, as a member would get it (with a sample score of 45), marked
// [Preview] in the subject. Nothing is logged against any member, and the
// stop link in a preview does nothing.
export async function sendFollowupPreview(to: string, firstName: string | null, key: CopyKey, copy: FollowupCopy | null | undefined, tag: string) {
  const [day, kind] = key.split("-");
  const m = followupEmail({ day: Number(day) as FollowupDay, hasStep: kind === "set", firstName, score: 45, links: PREVIEW_LINKS, copy });
  return sendEmail({
    to,
    subject: `[${tag}] ${m.subject}`,
    text: renderText({ heading: m.heading, blocks: m.blocks, signature: m.signature }),
    html: renderEmail({ preheader: m.preheader, heading: m.heading, blocks: m.blocks, signature: m.signature }),
    from: coachingFrom(m.signature.name),
    replyTo: COACHING_ADDRESS,
  }).catch(() => ({ ok: false as const, reason: "couldn’t send" }));
}

// Site health → "Send me the 8 follow-up emails": all eight, in the wording
// they'll actually go out in.
export async function sendFollowupPreviews(to: string, firstName: string | null, copy: CopyOverrides = {}): Promise<{ sent: number; failed: string | null }> {
  let sent = 0;
  let failed: string | null = null;
  for (const [i, key] of COPY_KEYS.entries()) {
    const [day, kind] = key.split("-");
    const result = await sendFollowupPreview(to, firstName, key, copy[key], `Preview ${i + 1}/8 · day ${day} · ${kind === "set" ? "Next Step set" : "no Next Step yet"}`);
    if (result.ok) sent += 1;
    else failed ??= result.reason;
    // Resend allows a couple of emails a second.
    await new Promise((r) => setTimeout(r, 600));
  }
  return { sent, failed };
}

// For Site health: is 0037 in, how many asked, how many have gone.
export async function getFollowupHealth(admin: Admin): Promise<{ installed: boolean; asked: number; sent: number; lastSent: string | null }> {
  const [asked, jobs] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("followups_email", true),
    admin.from("message_jobs").select("sent_at").eq("kind", "followup").eq("status", "sent").order("sent_at", { ascending: false }),
  ]);
  if (asked.error) return { installed: false, asked: 0, sent: 0, lastSent: null };
  return { installed: true, asked: asked.count ?? 0, sent: jobs.data?.length ?? 0, lastSent: (jobs.data?.[0]?.sent_at as string | null) ?? null };
}
