import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { longDay, nextReview } from "@/lib/review-schedule";
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
    .select("id, client_id, goal_title, focus_area, created_at, frequency, success_criteria, action_when")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: "goals query failed", sessions }, { status: 500 });

  const planned = (goals ?? []).filter((g) => g.frequency?.trim() && g.success_criteria?.trim());
  if (!planned.length) return NextResponse.json({ checked: 0, sent: 0, sessions });

  const ids = planned.map((g) => g.id);
  const [{ data: checkIns }, { data: profiles }, { data: sentLog }] = await Promise.all([
    admin.from("goal_checkins").select("goal_id, created_at").in("goal_id", ids),
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
    const next = nextReview({ start: g.created_at, actionWhen: g.action_when, reviews: reviewsByGoal.get(g.id) ?? [] });
    // Due today or in the last few days; one email per review.
    if (!next.due || next.daysAway < -6) continue;
    const dueDate = next.date;
    if (already.has(`${g.id}:${dueDate}`)) continue;
    const p = profileById.get(g.client_id);
    if (!p?.email) { skip("no email"); continue; }
    if (!p.reminders_email) { skip("opted out"); continue; }

    const first = p.full_name?.split(" ")[0];
    const area = g.focus_area ?? "your goal";
    const link = `${SITE_URL}/clear/review`;
    const off = `${SITE_URL}/api/reminders/unsubscribe?t=${p.email_token}`;
    const goal = g.goal_title?.trim() ?? "";
    const monthly = next.kind === "monthly";
    const blocks: Block[] = [
      { p: first ? `Hi ${first},` : "Hi," },
      {
        p: monthly
          ? `It’s time for your monthly review on ${area}: a month of practice, and a moment to score the area again.`
          : `It’s time for your weekly review on ${area}.`,
      },
      ...(goal ? [{ quote: goal } as Block] : []),
      {
        p: monthly
          ? "Two minutes: how the month went, where the area is now, and what next."
          : "About a minute: what happened, what helped or got in the way, and what you’re committing to next. A missed week is fine; it’s a chance to make it smaller.",
      },
      { button: { href: link, label: monthly ? "Do my monthly review" : "Do my weekly review" } },
      { smallLink: { lead: "You’re getting this because you set a plan with Aligned.", label: "Stop these reminders", href: off } },
    ];
    const heading = monthly ? `Your monthly review: ${area}` : `Your weekly review: ${area}`;
    const result = await sendEmail({
      to: p.email,
      subject: heading,
      text: renderText({ heading, blocks }),
      html: renderEmail({ preheader: monthly ? "A month of practice: two minutes to review it." : `${longDay(next.date)}: a minute on how your week went.`, heading, blocks }),
    });
    if (!result.ok) { skip(result.reason); continue; }
    await admin.from("reminder_log").insert({ client_id: g.client_id, goal_id: g.id, kind: "checkin", due_date: dueDate });
    sent += 1;
  }

  return NextResponse.json({ checked: planned.length, sent, skipped, sessions });
}
