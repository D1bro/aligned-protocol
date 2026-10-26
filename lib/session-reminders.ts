import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { COACHING_ADDRESS, coachingFrom, sendEmail, SITE_URL } from "@/lib/email";
import { buildMessage } from "@/lib/messages";
import { BUSINESS_TZ, formatSessionTime, isTomorrow, toLocalParts } from "@/lib/time";

// The day-before reminder for confirmed coaching sessions, run from the daily
// job. "Tomorrow" is in the session's own time zone. Each one is logged in
// message_jobs under a key for that session and time, so it goes once, and
// again only if the session moves to another day.

type Admin = ReturnType<typeof createAdminClient>;
type Row = { id: string; client_id: string; scheduled_at: string; timezone: string | null; duration_minutes: number; location: string | null };

export async function sendSessionReminders(admin: Admin, now: Date = new Date()) {
  const { data, error } = await admin
    .from("coaching_sessions")
    .select("id, client_id, scheduled_at, timezone, duration_minutes, location")
    .eq("state", "confirmed")
    .gt("scheduled_at", now.toISOString())
    .lt("scheduled_at", new Date(now.getTime() + 2 * 86_400_000).toISOString());
  if (error) return { error: "sessions query failed" };
  const due = ((data ?? []) as Row[]).filter((s) => isTomorrow(s.scheduled_at, s.timezone || BUSINESS_TZ, now));
  if (!due.length) return { due: 0, sent: 0 };

  const clientIds = [...new Set(due.map((s) => s.client_id))];
  const { data: clients } = await admin.from("profiles").select("id, email, full_name, coach_id").in("id", clientIds);
  const coachIds = [...new Set((clients ?? []).map((c) => c.coach_id).filter(Boolean))] as string[];
  const [{ data: coaches }, { data: summaries }] = await Promise.all([
    coachIds.length ? admin.from("profiles").select("id, full_name").in("id", coachIds) : Promise.resolve({ data: [] }),
    admin.from("session_summaries").select("id, client_id, published_at").in("client_id", clientIds).eq("status", "published").order("published_at", { ascending: false }),
  ]);
  // The open steps from each client's last shared summary.
  const lastSummary = new Map<string, string>();
  for (const s of summaries ?? []) if (!lastSummary.has(s.client_id)) lastSummary.set(s.client_id, s.id);
  const { data: steps } = lastSummary.size
    ? await admin
        .from("session_commitments")
        .select("summary_id, body")
        .in("summary_id", [...lastSummary.values()])
        .eq("owner", "client")
        .eq("status", "open")
        .eq("visible_to_client", true)
        .order("position")
    : { data: [] };

  let sent = 0;
  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] ?? 0) + 1);

  for (const s of due) {
    const c = (clients ?? []).find((x) => x.id === s.client_id);
    if (!c?.email) { skip("no email"); continue; }
    const tz = s.timezone || BUSINESS_TZ;
    const coachName = ((coaches ?? []).find((x) => x.id === c.coach_id)?.full_name as string | undefined)?.trim() || "Your coach";
    const location = s.location?.trim() || null;
    const m = buildMessage({
      kind: "session_reminder",
      firstName: c.full_name?.trim().split(/\s+/)[0] || "there",
      coachName,
      when: formatSessionTime(s.scheduled_at, tz),
      time: toLocalParts(s.scheduled_at, tz).time,
      durationMinutes: s.duration_minutes,
      joinUrl: location && /^https?:\/\//.test(location) ? location : null,
      place: location && !/^https?:\/\//.test(location) ? location : null,
      steps: (steps ?? []).filter((x) => x.summary_id === lastSummary.get(s.client_id)).map((x) => x.body as string).slice(0, 3),
      link: `${SITE_URL}/coaching`,
    });

    const dedupeKey = `reminder:${s.id}:${s.scheduled_at}`;
    const { data: job, error: claimErr } = await admin
      .from("message_jobs")
      .insert({ client_id: c.id, kind: "session_reminder", dedupe_key: dedupeKey, to_email: c.email, subject: m.subject, body_text: m.text, session_id: s.id })
      .select("id")
      .single();
    if (claimErr || !job) { skip(claimErr?.code === "23505" ? "already sent" : "couldn't log"); continue; }

    const result = await sendEmail({ to: c.email, subject: m.subject, text: m.text, html: m.html, from: coachingFrom(coachName), replyTo: COACHING_ADDRESS });
    await admin
      .from("message_jobs")
      .update(result.ok ? { status: "sent", sent_at: new Date().toISOString(), provider_id: result.id, attempts: 1 } : { status: "failed", error: result.reason, attempts: 1 })
      .eq("id", job.id);
    if (result.ok) sent += 1;
    else skip(result.reason);
  }
  return { due: due.length, sent, skipped };
}
