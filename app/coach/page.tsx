import Link from "next/link";
import { requireAdmin, getMetrics, getClientSummaries } from "@/lib/actions/admin";
import { formatDate } from "@/lib/audit-schedule";

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const DAY = 86_400_000;

// Overview: the numbers that decide what to build next, and who needs
// attention. Counts only; self-reported scores are not used as success.
export default async function OverviewPage() {
  await requireAdmin();
  const [m, clients] = await Promise.all([getMetrics(), getClientSummaries()]);

  if (!m || !clients) {
    return (
      <div className="page">
        <div className="eyebrow"><span className="eydot" /> Overview</div>
        <h1>The console isn&rsquo;t switched on yet</h1>
        <p className="lead">
          Run <code>supabase/migrations/0011_admin_console.sql</code> in the Supabase SQL Editor, then reload this page.
        </p>
      </div>
    );
  }

  const funnel = [
    { label: "Took the audit", sub: "including guests", n: m.people_audited },
    { label: "Created an account", sub: "members", n: m.members },
    { label: "Member with an audit", sub: "", n: m.members_audited },
    { label: "Set a plan", sub: "action, when and 'done when'", n: m.plans_set },
    { label: "Recorded an action", sub: "at a goal check-in", n: m.first_action },
  ];
  const top = Math.max(1, ...funnel.map((f) => f.n));

  const members = clients.filter((c) => c.email);
  const now = Date.now();
  const noPlan = members.filter((c) => c.audits > 0 && !c.plan_set);
  const noCheckIn = members.filter((c) => c.plan_set && c.checkins === 0);
  const quiet = members.filter((c) => c.last_active_at && now - new Date(c.last_active_at).getTime() > 30 * DAY);
  const noCoach = members.filter((c) => !c.coach_id);

  const attention = [
    { title: "New coaching enquiries", n: m.enquiries_new, href: "/coach/enquiries", people: [] as typeof members },
    { title: "Audit done, no plan yet", n: noPlan.length, href: "/coach/clients?stage=no-plan", people: noPlan },
    { title: "Plan set, no goal check-in yet", n: noCheckIn.length, href: "/coach/clients?stage=no-checkin", people: noCheckIn },
    { title: "Quiet for 30+ days", n: quiet.length, href: "/coach/clients?stage=quiet", people: quiet },
    { title: "No coach assigned", n: noCoach.length, href: "/coach/clients?coach=none", people: noCoach },
  ];

  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Overview</div>
      <h1>How the Aligned Protocol is doing</h1>
      <p className="lead">
        Real activity only: accounts, audits, plans, recorded actions, lessons and return visits. Scores are
        self-reported, so they aren&rsquo;t used as a measure of success here.
      </p>

      <div className="admin-stats">
        <div><b>{m.members}</b><span>Members</span><em>+{m.members_30d} in 30 days · {m.guests} guests</em></div>
        <div><b>{m.audits}</b><span>Audits completed</span><em>+{m.audits_30d} in 30 days</em></div>
        <div><b>{m.checkins}</b><span>Goal check-ins</span><em>+{m.checkins_30d} in 30 days</em></div>
        <div><b>{m.goals_done}</b><span>Goals completed</span><em>by members</em></div>
        <div><b>{m.lessons_done}</b><span>Lessons completed</span><em>{m.people_learning} {m.people_learning === 1 ? "person" : "people"} learning</em></div>
        <div><b>{m.came_back}</b><span>Came back</span><em>active on 2+ different days</em></div>
        <div><b>{m.active_30d}</b><span>Active in 30 days</span><em>members doing anything</em></div>
        <div><b>{m.enquiries}</b><span>Coaching enquiries</span><em>{m.enquiries_new} new · {m.enquiries_booked} booked</em></div>
      </div>

      <div className="admin-grid">
        <section className="admin-card" aria-labelledby="funnel-h">
          <h2 id="funnel-h">From audit to action</h2>
          <p className="admin-card-sub">People who reached each step. The percentage is of the step before.</p>
          <ol className="admin-funnel">
            {funnel.map((f, i) => (
              <li key={f.label}>
                <div className="admin-funnel-top">
                  <span>{f.label}{f.sub ? <em> · {f.sub}</em> : null}</span>
                  <b>
                    {f.n}
                    {i > 0 ? <small> · {pct(f.n, funnel[i - 1].n)}%</small> : null}
                  </b>
                </div>
                <div className="admin-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(f.n ? 2 : 0, (f.n / top) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-card" aria-labelledby="attention-h">
          <h2 id="attention-h">Needs attention</h2>
          <ul className="admin-attention">
            {attention.map((a) => (
              <li key={a.title}>
                <Link href={a.href}>
                  <span>{a.title}</span>
                  <b className={a.n ? "on" : undefined}>{a.n}</b>
                </Link>
                {a.people.length ? (
                  <p>
                    {a.people.slice(0, 3).map((p, i) => (
                      <span key={p.id}>
                        {i ? ", " : ""}
                        <Link href={`/coach/clients/${p.id}`}>{p.full_name || p.email}</Link>
                      </span>
                    ))}
                    {a.people.length > 3 ? ` and ${a.people.length - 3} more` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="admin-card admin-recent" aria-labelledby="recent-h">
        <h2 id="recent-h">Recently active</h2>
        {members.length ? (
          <ul>
            {members.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link href={`/coach/clients/${c.id}`}>{c.full_name || c.email}</Link>
                <span>{c.main_goal_area ?? (c.audits ? "Audit done" : "No audit yet")}</span>
                <em>{c.last_active_at ? formatDate(c.last_active_at) : "—"}</em>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-card-sub">No members yet.</p>
        )}
        <Link href="/coach/clients" className="au-text-link">All clients</Link>
      </section>
    </div>
  );
}
