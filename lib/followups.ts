import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { COACHING_ADDRESS, coachingFrom, sendEmail, SITE_URL } from "@/lib/email";
import { renderEmail, renderText } from "@/lib/email-layout";
import { isSet } from "@/lib/next-step";
import { localDate, toLocalParts } from "@/lib/time";
import { dueFollowup, FOLLOWUP_DAYS, followupEmail, SEND_HOUR_LONDON } from "@/lib/followup-content";

// The follow-up emails after the audit, run each morning by
// /api/cron/followups. Only for people who asked for them (profiles.
// followups_email, migration 0037), and never once they've moved on: an
// enquiry, a coach, a membership or an invoice means Duane is already in
// touch, so the sequence stops for good. Each email is claimed in
// message_jobs under "followup:<client>:<day>" before it's sent, so it can
// only go once.

type Admin = ReturnType<typeof createAdminClient>;
const LIVE_MEMBERSHIP = ["active", "trialing", "past_due"];

export async function sendFollowups(admin: Admin, now: Date = new Date()) {
  if (Number(toLocalParts(now).time.slice(0, 2)) !== SEND_HOUR_LONDON) return { skipped: "not 9am in London" };

  const { data: people, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role, coach_id, reminders_email, followups_at, email_token")
    .eq("followups_email", true)
    .eq("role", "client")
    .is("coach_id", null);
  if (error) return { error: "profiles query failed" };
  const candidates = (people ?? []).filter((p) => p.email);
  if (!candidates.length) return { checked: 0, sent: 0 };
  const ids = candidates.map((p) => p.id as string);

  const [audits, goals, enquiries, memberships, invoices, jobs, checkinsToday] = await Promise.all([
    admin.from("audits").select("client_id, total_score, completed_at").in("client_id", ids).eq("status", "completed").order("completed_at", { ascending: true }),
    admin.from("goals").select("id, client_id, status, set_at, frequency, success_criteria").in("client_id", ids).eq("status", "active"),
    admin.from("coaching_enquiries").select("client_id").in("client_id", ids),
    admin.from("memberships").select("client_id, status").in("client_id", ids).in("status", LIVE_MEMBERSHIP),
    admin.from("invoices").select("client_id").in("client_id", ids).neq("status", "void"),
    admin.from("message_jobs").select("client_id, dedupe_key").in("client_id", ids).eq("kind", "followup"),
    admin.from("reminder_log").select("client_id, sent_at").in("client_id", ids).gte("sent_at", new Date(now.getTime() - 86_400_000).toISOString()),
  ]);
  if (audits.error || goals.error || jobs.error) return { error: "lookup failed" };

  const stopped = new Set<string>([
    ...(enquiries.data ?? []).map((r) => r.client_id as string),
    ...(memberships.data ?? []).map((r) => r.client_id as string),
    ...(invoices.data ?? []).map((r) => r.client_id as string),
  ]);
  const today = localDate(now);
  const checkinToday = new Set((checkinsToday.data ?? []).filter((r) => localDate(r.sent_at as string) === today).map((r) => r.client_id as string));

  let sent = 0;
  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] ?? 0) + 1);

  for (const p of candidates) {
    const id = p.id as string;
    if (stopped.has(id)) { skip("moved on"); continue; }
    const mine = (audits.data ?? []).filter((a) => a.client_id === id);
    const first = mine[0];
    if (!first) { skip("no audit yet"); continue; }
    if (checkinToday.has(id)) { skip("check-in email today"); continue; }

    const auditDay = localDate(first.completed_at as string);
    const optedDay = p.followups_at ? localDate(p.followups_at as string) : auditDay;
    const start = optedDay > auditDay ? optedDay : auditDay;
    const step = (goals.data ?? []).find((g) => g.client_id === id && isSet(g));
    const sentDays = (jobs.data ?? []).filter((j) => j.client_id === id).map((j) => Number(String(j.dedupe_key).split(":")[2]));
    const day = dueFollowup({ start, today, sent: sentDays, hasStep: !!step, checkinEmailOn: !!p.reminders_email });
    if (!day) continue;

    const latest = mine[mine.length - 1];
    const m = followupEmail({
      day,
      firstName: (p.full_name as string | null) ?? null,
      score: (latest.total_score as number | null) ?? null,
      hasStep: !!step,
      links: {
        nextStep: `${SITE_URL}/next-step`,
        checkIn: step ? `${SITE_URL}/next-step/check-in?goal=${step.id}` : `${SITE_URL}/next-step`,
        coaching: `${SITE_URL}/coaching`,
        stop: `${SITE_URL}/api/reminders/unsubscribe?t=${p.email_token}&list=followups`,
      },
    });
    const text = renderText({ heading: m.heading, blocks: m.blocks, signature: m.signature });
    const { data: job, error: claimErr } = await admin
      .from("message_jobs")
      .insert({ client_id: id, kind: "followup", dedupe_key: `followup:${id}:${day}`, to_email: p.email, subject: m.subject, body_text: text })
      .select("id")
      .single();
    if (claimErr || !job) { skip(claimErr?.code === "23505" ? "already sent" : "couldn't log"); continue; }

    const result = await sendEmail({
      to: p.email as string,
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
  return { checked: candidates.length, sent, skipped };
}

// Site health → "Send me the follow-up emails": all eight versions, to one
// address, exactly as a member would get them, so Duane can read them in
// his own inbox. Nothing is logged against any member. The subject says
// which one it is; the stop link in a preview does nothing.
export async function sendFollowupPreviews(to: string, firstName: string | null): Promise<{ sent: number; failed: string | null }> {
  let sent = 0;
  let n = 0;
  let failed: string | null = null;
  for (const day of FOLLOWUP_DAYS) {
    for (const hasStep of [false, true]) {
      n += 1;
      const m = followupEmail({
        day,
        firstName,
        score: 45,
        hasStep,
        links: {
          nextStep: `${SITE_URL}/next-step`,
          checkIn: `${SITE_URL}/next-step`,
          coaching: `${SITE_URL}/coaching`,
          stop: `${SITE_URL}/api/reminders/unsubscribe?t=preview&list=followups`,
        },
      });
      const subject = `[Preview ${n}/8 · day ${day} · ${hasStep ? "Next Step set" : "no Next Step yet"}] ${m.subject}`;
      const result = await sendEmail({
        to,
        subject,
        text: renderText({ heading: m.heading, blocks: m.blocks, signature: m.signature }),
        html: renderEmail({ preheader: m.preheader, heading: m.heading, blocks: m.blocks, signature: m.signature }),
        from: coachingFrom(m.signature.name),
        replyTo: COACHING_ADDRESS,
      }).catch(() => ({ ok: false as const, reason: "couldn’t send" }));
      if (result.ok) sent += 1;
      else failed ??= result.reason;
      // Resend allows a couple of emails a second.
      await new Promise((r) => setTimeout(r, 600));
    }
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
