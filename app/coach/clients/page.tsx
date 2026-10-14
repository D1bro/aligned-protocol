import Link from "next/link";
import { requireStaff, getClientSummaries, getStaff, type ClientSummary } from "@/lib/actions/admin";
import { getMyClients } from "@/lib/actions/coach";
import { formatDate } from "@/lib/audit-schedule";
import { AddClientForm } from "../AddClientForm";

const DAY = 86_400_000;
const STAGES: Record<string, { label: string; test: (c: ClientSummary) => boolean }> = {
  "no-audit": { label: "No audit yet", test: (c) => c.audits === 0 },
  "no-plan": { label: "Audit done, no plan", test: (c) => c.audits > 0 && !c.plan_set },
  "no-checkin": { label: "Plan set, no check-in", test: (c) => c.plan_set && c.checkins === 0 },
  active: { label: "Checking in", test: (c) => c.checkins > 0 },
  quiet: { label: "Quiet 30+ days", test: (c) => !!c.last_active_at && Date.now() - new Date(c.last_active_at).getTime() > 30 * DAY },
};

function stageOf(c: ClientSummary) {
  if (c.audits === 0) return "No audit yet";
  if (!c.plan_set) return c.active_goals ? "Plan in progress" : "Audit done";
  if (c.checkins === 0) return "Plan set";
  return `${c.checkins} check-in${c.checkins === 1 ? "" : "s"}`;
}

// Clients: everyone (admins) or your own clients (coaches), searchable and
// filterable, each opening their full workspace.
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; coach?: string; stage?: string; guests?: string }>;
}) {
  const me = await requireStaff();
  const { q = "", coach = "all", stage = "", guests } = await searchParams;
  const [all, staff] = await Promise.all([getClientSummaries(), me.role === "admin" ? getStaff() : Promise.resolve([])]);

  // Before migration 0011, fall back to the coach's own roster.
  if (!all) {
    const mine = await getMyClients();
    return (
      <div className="page">
        <div className="eyebrow"><span className="eydot" /> Clients</div>
        <h1>Your clients</h1>
        <p className="lead">Run migration 0011 in Supabase to switch on the full client list.</p>
        <AddClientForm />
        <ul className="admin-list">
          {mine.map((c) => (
            <li key={c.id}><Link href={`/coach/clients/${c.id}`}>{c.full_name || c.email}</Link></li>
          ))}
        </ul>
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const shown = all
    .filter((c) => (guests ? true : !!c.email))
    .filter((c) => !needle || `${c.full_name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(needle))
    .filter((c) => (coach === "all" ? true : coach === "none" ? !c.coach_id : coach === "me" ? c.coach_id === me.id : c.coach_id === coach))
    .filter((c) => (STAGES[stage] ? STAGES[stage].test(c) : true));
  const guestCount = all.filter((c) => !c.email).length;

  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Clients</div>
      <h1>{me.role === "admin" ? "All clients" : "Your clients"}</h1>
      <p className="lead">
        {shown.length} of {all.filter((c) => guests || c.email).length} shown. Open someone to see their audit, plan,
        goal check-ins, shared reflections and notes.
      </p>

      <form className="admin-filters" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search clients" />
        {me.role === "admin" ? (
          <select name="coach" defaultValue={coach} aria-label="Coach">
            <option value="all">Any coach</option>
            <option value="me">My clients</option>
            <option value="none">No coach</option>
            {staff.filter((s) => s.id !== me.id).map((s) => (
              <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
            ))}
          </select>
        ) : null}
        <select name="stage" defaultValue={stage} aria-label="Stage">
          <option value="">Any stage</option>
          {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {guestCount ? (
          <label className="admin-check">
            <input type="checkbox" name="guests" value="1" defaultChecked={!!guests} /> Include {guestCount} guest{guestCount === 1 ? "" : "s"}
          </label>
        ) : null}
        <button type="submit" className="btn btn-g">Filter</button>
        {q || coach !== "all" || stage || guests ? <Link href="/coach/clients" className="au-text-link">Clear</Link> : null}
      </form>

      {shown.length ? (
        <div className="admin-table" role="table" aria-label="Clients">
          <div className="admin-row head" role="row">
            <span role="columnheader">Client</span>
            <span role="columnheader">Main goal</span>
            <span role="columnheader">Stage</span>
            <span role="columnheader">Latest audit</span>
            <span role="columnheader">Lessons</span>
            <span role="columnheader">Last active</span>
          </div>
          {shown.map((c) => (
            <Link key={c.id} href={`/coach/clients/${c.id}`} className="admin-row" role="row">
              <span role="cell" className="admin-who">
                <b>{c.full_name || (c.email ? "Unnamed" : "Guest")}</b>
                <em>{c.email ?? "No account yet"}</em>
                {me.role === "admin" ? <em className="admin-coach">{c.coach_name ? `Coach: ${c.coach_name}` : "No coach"}</em> : null}
              </span>
              <span role="cell">
                {c.main_goal ? <>{c.main_goal_area ? <em>{c.main_goal_area}</em> : null}{c.main_goal}</> : <em>—</em>}
              </span>
              <span role="cell">
                {stageOf(c)}
                {c.goals_done ? <em className="admin-done">✓ {c.goals_done} goal{c.goals_done === 1 ? "" : "s"} done</em> : null}
                {c.enquiry_status ? <em className="admin-enq">Enquiry: {c.enquiry_status}</em> : null}
              </span>
              <span role="cell">
                {c.last_audit_at ? <>{c.last_audit_score ?? 0}/100<em>{formatDate(c.last_audit_at)}</em></> : <em>—</em>}
              </span>
              <span role="cell">{c.lessons_done} of 4</span>
              <span role="cell">{c.last_active_at ? formatDate(c.last_active_at) : "—"}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">◇</span>
          No clients match.
        </div>
      )}

      <div className="sec-head">Invite a client</div>
      <AddClientForm />
    </div>
  );
}
