import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { longDay, nextReview } from "@/lib/review-schedule";
import { isSet } from "@/lib/next-step";
import { sendEmail, SITE_URL } from "@/lib/email";
import { renderEmail, renderText, type Block } from "@/lib/email-layout";
import { sendSessionReminders } from "@/lib/session-reminders";

// Daily job (vercel.json "crons"): remind clients of tomorrow's coaching
// sessions, and email everyone whose weekly review (or, every fourth week,
// monthly review) is due, once per review (lib/review-schedule.ts). Vercel
// calls it with "Authorization: Bearer <CRON_SECRET>"; anything else is
// refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const sessions = await sendSessionReminders(admin);
  const { data: goals, error } = await admin
    .from("goals")
    .select("id, client_id, goal_title, focus_area, created_at, frequency, success_criteria, action_when, set_at")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: "goals query failed", sessions }, { status: 500 });

  // Every set Next Step gets a weekly check-in.
  const planned = (goals ?? []).filter((g) => isSet(g));
  if (!planned.length) return NextResponse.json({ checked: 0, sent: 0, sessions });

  const ids = planned.map((g) => g.id);
  const [{ data: checkIns }, { data: profiles }, { data: sentLog }] = await Promise.all([
    admin.from("goal_checkins").select("goal_id, created_at").in("goal_id", ids).eq("kind", "weekly"),
    admin.from("profiles").select("id, email, full_name, reminders_email, email_token").in("id", planned.map((g) => g.client_id)),
    admin.from("reminder_log").select("goal_id, due_date").in("goal_id", ids),
  ]);
  const reviewsByGoal = new Map<string, { created_at: string }[]>();
  for (const c of checkIns ?? []) reviewsByGoal.set(c.goal_id, [...(reviewsByGoal.get(c.goal_id) ?? []), c]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const already = new Set((sentLog ?? []).map((r) => `${r.goal_id}:${r.due_date}`));

  let sent = 0;
  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] ?? 0) + 1);

  for (const g of planned) {
    const next = nextReview({ start: g.set_at ?? g.created_at, actionWhen: g.action_when, reviews: reviewsByGoal.get(g.id) ?? [], monthly: false });
    // Due today or in the last few days; one email per review.
    if (!next.due || next.daysAway < -6) continue;
    const dueDate = next.date;
    if (already.has(`${g.id}:${dueDate}`)) continue;
    const p = profileById.get(g.client_id);
    if (!p?.email) { skip("no email"); continue; }
    if (!p.reminders_email) { skip("opted out"); continue; }

    const first = p.full_name?.split(" ")[0];
    const area = g.focus_area ?? "your Next Step";
    const link = `${SITE_URL}/next-step/check-in?goal=${g.id}`;
    const off = `${SITE_URL}/api/reminders/unsubscribe?t=${p.email_token}`;
    const goal = g.goal_title?.trim() ?? "";
    const blocks: Block[] = [
      { p: first ? `Hi ${first},` : "Hi," },
      { p: `It’s time for your weekly check-in on your Next Step in ${area}.` },
      ...(goal ? [{ quote: goal } as Block] : []),
      { p: "About a minute. One question: is it closer? Then tick off your moves and say what moved it, or what got in the way." },
      { button: { href: link, label: "Do my check-in" } },
      { smallLink: { lead: "You’re getting this because you set a Next Step with Aligned.", label: "Stop these reminders", href: off } },
    ];
    const heading = `Your weekly check-in: ${area}`;
    const result = await sendEmail({
      to: p.email,
      subject: heading,
      text: renderText({ heading, blocks }),
      html: renderEmail({ preheader: `${longDay(next.date)}: is your Next Step closer?`, heading, blocks }),
    });
    if (!result.ok) { skip(result.reason); continue; }
    await admin.from("reminder_log").insert({ client_id: g.client_id, goal_id: g.id, kind: "checkin", due_date: dueDate });
    sent += 1;
  }

  return NextResponse.json({ checked: planned.length, sent, skipped, sessions });
}
