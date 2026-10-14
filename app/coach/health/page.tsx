import { requireAdmin, getMetrics, getReminderStatus } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { EPISODES, MUSINGS, PATHS } from "@/lib/learn-content";
import { formatDate } from "@/lib/audit-schedule";

type Check = { label: string; ok: boolean; detail: string };

// Site health: what's switched on, what's still draft, and where to look.
export default async function HealthPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [metrics, reminders, sharing, mainGoalFn] = await Promise.all([
    getMetrics(),
    getReminderStatus(),
    supabase.from("lesson_progress").select("private").limit(1),
    supabase.rpc("set_main_goal", { p_goal_id: "00000000-0000-0000-0000-000000000000" }),
  ]);

  const database: Check[] = [
    { label: "Lesson sharing (0009)", ok: !sharing.error, detail: sharing.error ? "Not found — run migration 0009" : "Installed" },
    { label: "Main goal switch (0010)", ok: !mainGoalFn.error, detail: mainGoalFn.error ? "Not found — run migration 0010" : "Installed" },
    { label: "Admin console (0011)", ok: !!metrics, detail: metrics ? "Installed" : "Not found — run migration 0011" },
  ];

  const email: Check[] = [
    {
      label: "Goal check-in reminder emails",
      ok: reminders.configured,
      detail: reminders.configured
        ? reminders.lastSent
          ? `On · ${reminders.sentTotal} sent, last ${formatDate(reminders.lastSent)}`
          : "On · none sent yet"
        : "Off — add RESEND_API_KEY, REMINDER_FROM and CRON_SECRET in Vercel",
    },
    {
      label: "Coaching enquiry alerts",
      ok: Boolean(process.env.ENQUIRY_NOTIFY && process.env.RESEND_API_KEY),
      detail: process.env.ENQUIRY_NOTIFY ? (process.env.RESEND_API_KEY ? "On" : "Waiting for Resend") : "Off — optional: add ENQUIRY_NOTIFY in Vercel",
    },
  ];

  const lessons = PATHS.flatMap((p) => p.lessons);
  const content = [
    { label: "Academy lessons", draft: lessons.filter((l) => l.draft).length, total: lessons.length, noVideo: lessons.filter((l) => !l.video).length },
    { label: "Musings", draft: MUSINGS.filter((m) => m.draft).length, total: MUSINGS.length, noVideo: MUSINGS.filter((m) => !m.video).length },
    { label: "Podcast episodes", draft: EPISODES.filter((e) => e.draft).length, total: EPISODES.length, noVideo: EPISODES.filter((e) => !e.audio && !e.video).length },
  ];

  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0];

  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Site health</div>
      <h1>What&rsquo;s switched on</h1>
      <p className="lead">Checked live each time you open this page.</p>

      <div className="admin-grid">
        <section className="admin-card" aria-labelledby="h-db">
          <h2 id="h-db">Database updates</h2>
          <CheckList checks={database} />
        </section>
        <section className="admin-card" aria-labelledby="h-email">
          <h2 id="h-email">Email</h2>
          <CheckList checks={email} />
        </section>
      </div>

      <div className="admin-grid">
        <section className="admin-card" aria-labelledby="h-content">
          <h2 id="h-content">Content still in draft</h2>
          <ul className="admin-content">
            {content.map((c) => (
              <li key={c.label}>
                <b>{c.label}</b>
                <span>{c.draft} of {c.total} draft · {c.noVideo} waiting for a recording</span>
              </li>
            ))}
            <li>
              <b>Coaching page</b>
              <span>Draft wording · Focus Series priced on enquiry</span>
            </li>
          </ul>
          <p className="admin-card-sub">Wording and recordings live in <code>lib/learn-content.ts</code>.</p>
        </section>

        <section className="admin-card" aria-labelledby="h-deploy">
          <h2 id="h-deploy">This version</h2>
          <ul className="admin-content">
            <li>
              <b>Running</b>
              <span>{process.env.VERCEL_ENV ? `Vercel · ${process.env.VERCEL_ENV}` : "Local development"}</span>
            </li>
            <li>
              <b>Code version</b>
              <span>{sha ? `${sha.slice(0, 7)} · ${message ?? ""}` : "Not deployed (local)"}</span>
            </li>
          </ul>
          <p className="admin-links">
            <a href="https://supabase.com/dashboard/project/yeedrmvikdjcrjvfyceo" target="_blank" rel="noreferrer">Supabase ↗</a>
            <a href="https://vercel.com/d1bro-1939s-projects/aligned-protocol" target="_blank" rel="noreferrer">Vercel ↗</a>
            <a href="https://resend.com" target="_blank" rel="noreferrer">Resend ↗</a>
          </p>
        </section>
      </div>
    </div>
  );
}

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="admin-checks">
      {checks.map((c) => (
        <li key={c.label} className={c.ok ? "ok" : "off"}>
          <span aria-hidden="true">{c.ok ? "✓" : "!"}</span>
          <div>
            <b>{c.label}</b>
            <em>{c.ok ? "" : "Needs attention · "}{c.detail}</em>
          </div>
        </li>
      ))}
    </ul>
  );
}
