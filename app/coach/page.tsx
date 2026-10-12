import Link from "next/link";
import { getMyClients, getEnquiries } from "@/lib/actions/coach";
import { formatDate } from "@/lib/audit-schedule";
import { AddClientForm } from "./AddClientForm";
import { EnquiryStatus } from "./EnquiryStatus";

function scoreBadgeClass(score: number | null) {
  if (score === null) return "score-mid";
  if (score >= 70) return "score-high";
  if (score >= 40) return "score-mid";
  return "score-low";
}

export default async function CoachPage() {
  const [clients, enquiries] = await Promise.all([getMyClients(), getEnquiries()]);
  const openCount = enquiries.filter((e) => e.status === "new").length;

  return (
    <div className="page">
      <div className="eyebrow"><span className="eydot" /> Coach dashboard</div>
      <h1>Your clients</h1>
      <p className="lead">
        {clients.length} client{clients.length === 1 ? "" : "s"} assigned to you. Add a new one below — they
        get an email invite to set their own password; your own session is never touched.
      </p>

      <AddClientForm />

      <div className="sec-head">Coaching enquiries{openCount ? ` · ${openCount} new` : ""}</div>
      {enquiries.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">◇</span>
          No enquiries yet. They arrive here from the Coaching page.
        </div>
      ) : (
        <ul className="enq-list">
          {enquiries.map((e) => (
            <li key={e.id} className={e.status === "new" ? "new" : undefined}>
              <div className="enq-head">
                <div>
                  <b>{e.name || "Unnamed"}</b>
                  {e.email ? <a href={`mailto:${e.email}`}>{e.email}</a> : null}
                  <span>{formatDate(e.created_at)}</span>
                </div>
                <EnquiryStatus id={e.id} initial={e.status} />
              </div>
              <dl>
                <dt>Wants help with</dt><dd>{e.wants_help}</dd>
                {e.tried ? (<><dt>Tried so far</dt><dd>{e.tried}</dd></>) : null}
                {e.availability ? (<><dt>When suits</dt><dd>{e.availability}</dd></>) : null}
              </dl>
            </li>
          ))}
        </ul>
      )}

      <div className="sec-head">Client roster</div>
      {clients.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">◇</span>
          No clients yet — add one above.
        </div>
      ) : (
        <div className="area-grid">
          {clients.map((c) => (
            <Link key={c.id} href={`/coach/clients/${c.id}`} className="client-card">
              <div className="c-name">{c.full_name || "Unnamed client"}</div>
              <div className="c-email">{c.email}</div>
              {c.latestScore !== null ? (
                <span className={`score-badge ${scoreBadgeClass(c.latestScore)}`}>{c.latestScore}/100</span>
              ) : (
                <span className="score-badge score-mid">No audit yet</span>
              )}
              {c.focusArea ? (
                <div className="body-t" style={{ marginTop: ".5rem" }}>Starting area: {c.focusArea}</div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
