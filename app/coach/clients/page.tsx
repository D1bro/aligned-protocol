import Link from "next/link";
import { requireStaff, getClientSummaries, getStaff } from "@/lib/actions/admin";
import { getMyClients } from "@/lib/actions/coach";
import { formatDate } from "@/lib/audit-schedule";
import { AddClientForm } from "../AddClientForm";
import { buildView, filterPeople, stageOf, STAGES, type ViewKey } from "@/lib/console-views";
import { ClientTabs, VIEWS } from "./ClientTabs";

function qs(params: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const t = u.toString();
  return t ? `?${t}` : "";
}


// Clients: everyone (admins) or your own clients (coaches), searchable and
// filterable, each opening their full workspace.
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; coach?: string; stage?: string; guests?: string; view?: string; status?: string; did?: string }>;
}) {
  const me = await requireStaff();
  const params = await searchParams;
  const { q = "", coach = "all", stage = "", guests, status, did } = params;
  const view = VIEWS.includes(params.view as ViewKey) ? (params.view as ViewKey) : null;
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
  const tabs = <ClientTabs current={view ?? "people"} isAdmin={me.role === "admin"} />;

  // A list behind one of the Overview numbers.
  if (view) {
    const v = await buildView(view, { includeGuests: !!guests || view === "audits", status, didIt: !!did }, all);
    const rows = v.rows.filter((r) => !needle || r.cells[0].toLowerCase().includes(needle));
    const exportHref = `/coach/clients/export${qs({ view, q, guests, status, did })}`;
    return (
      <div className="page admin-page">
        <div className="eyebrow"><span className="eydot" /> Clients</div>
        <h1>{v.title}</h1>
        <p className="lead">{v.lead} {rows.length} shown.</p>
        {tabs}
        <form className="admin-filters" method="get">
          <input type="hidden" name="view" value={view} />
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {did ? <input type="hidden" name="did" value={did} /> : null}
          <input type="search" name="q" defaultValue={q} placeholder="Search by name" aria-label="Search" />
          {view !== "audits" ? (
            <label className="admin-check">
              <input type="checkbox" name="guests" value="1" defaultChecked={!!guests} /> Include guests
            </label>
          ) : null}
          <button type="submit" className="btn btn-g">Filter</button>
          <a href={exportHref} className="au-text-link">Export CSV</a>
        </form>
        {rows.length ? (
          <div className="admin-table admin-generic" role="table" aria-label={v.title} style={{ ["--cols" as string]: v.columns.length }}>
            <div className="admin-row head" role="row">
              {v.columns.map((c) => <span key={c} role="columnheader">{c}</span>)}
            </div>
            {rows.map((r, i) => (
              <Link key={i} href={`/coach/clients/${r.personId}`} className="admin-row" role="row">
                {r.cells.map((c, j) => <span key={j} role="cell" className={j === 0 ? "admin-who" : undefined}>{j === 0 ? <b>{c}</b> : c}</span>)}
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="empty-icon" aria-hidden="true">◇</span>
            Nothing here yet.
          </div>
        )}
      </div>
    );
  }

  const shown = filterPeople(all, { q, coach, stage, guests: !!guests }, me.id);
  const guestCount = all.filter((c) => !c.email).length;

  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Clients</div>
      <h1>{me.role === "admin" ? "All clients" : "Your clients"}</h1>
      <p className="lead">
        {shown.length} of {all.filter((c) => guests || c.email).length} shown. Open someone to see their audit, plan,
        goal check-ins, shared reflections and notes.
      </p>

      {tabs}
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
        <a href={`/coach/clients/export${qs({ q, coach: coach === "all" ? undefined : coach, stage, guests })}`} className="au-text-link">Export CSV</a>
        {me.role === "admin" ? <Link href="/coach/clients/guests" className="au-text-link">Manage guests</Link> : null}
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
                <b>{c.full_name || (c.email ? "Unnamed" : "Guest (no account)")}</b>
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
