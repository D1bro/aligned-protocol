import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextCheckInDue } from "@/lib/audit-schedule";
import { sendEmail, SITE_URL } from "@/lib/email";
import { renderEmail, renderText, type Block } from "@/lib/email-layout";
import { sendSessionReminders } from "@/lib/session-reminders";

// Daily job (vercel.json "crons"): remind clients of tomorrow's coaching
// sessions, and email everyone whose monthly check-in is due, once per check-in. Vercel calls it with "Authorization: Bearer
// <CRON_SECRET>"; anything else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const sessions = await sendSessionReminders(admin);
  const { data: goals, error } = await admin
    .from("goals")
    .select("id, client_id, goal_title, focus_area, created_at, frequency, success_criteria")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: "goals query failed", sessions }, { status: 500 });

  const planned = (goals ?? []).filter((g) => g.frequency?.trim() && g.success_criteria?.trim());
  if (!planned.length) return NextResponse.json({ checked: 0, sent: 0, sessions });

  const ids = planned.map((g) => g.id);
  const [{ data: checkIns }, { data: profiles }, { data: sentLog }] = await Promise.all([
    admin.from("goal_checkins").select("goal_id, created_at").in("goal_id", ids).order("created_at", { ascending: false }),
    admin.from("profiles").select("id, email, full_name, reminders_email, email_token").in("id", planned.map((g) => g.client_id)),
    admin.from("reminder_log").select("goal_id, due_date").in("goal_id", ids),
  ]);
  const lastCheckIn = new Map<string, string>();
  for (const c of checkIns ?? []) if (!lastCheckIn.has(c.goal_id)) lastCheckIn.set(c.goal_id, c.created_at);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const already = new Set((sentLog ?? []).map((r) => `${r.goal_id}:${r.due_date}`));

  let sent = 0;
  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] ?? 0) + 1);

  for (const g of planned) {
    const due = nextCheckInDue(lastCheckIn.get(g.id) ?? g.created_at);
    if (due.getTime() > Date.now()) continue;
    const dueDate = due.toISOString().slice(0, 10);
    if (already.has(`${g.id}:${dueDate}`)) continue;
    const p = profileById.get(g.client_id);
    if (!p?.email) { skip("no email"); continue; }
    if (!p.reminders_email) { skip("opted out"); continue; }

    const first = p.full_name?.split(" ")[0];
    const area = g.focus_area ?? "your goal";
    const link = `${SITE_URL}/clear/check-in`;
    const off = `${SITE_URL}/api/reminders/unsubscribe?t=${p.email_token}`;
    const goal = g.goal_title?.trim() ?? "";
    const blocks: Block[] = [
      { p: first ? `Hi ${first},` : "Hi," },
      { p: `It’s time for your monthly check-in on ${area}.` },
      ...(goal ? [{ quote: goal } as Block] : []),
      { p: "Two minutes: did you do it, where the area is now, and what next." },
      { button: { href: link, label: "Check in now" } },
      { smallLink: { lead: "You’re getting this because you set a goal in the Aligned Protocol.", label: "Stop these reminders", href: off } },
    ];
    const heading = `Your monthly check-in: ${area}`;
    const result = await sendEmail({
      to: p.email,
      subject: heading,
      text: renderText({ heading, blocks }),
      html: renderEmail({ preheader: "Two minutes on how your goal is going.", heading, blocks }),
    });
    if (!result.ok) { skip(result.reason); continue; }
    await admin.from("reminder_log").insert({ client_id: g.client_id, goal_id: g.id, kind: "checkin", due_date: dueDate });
    sent += 1;
  }

  return NextResponse.json({ checked: planned.length, sent, skipped, sessions });
}
