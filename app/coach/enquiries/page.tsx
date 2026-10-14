import Link from "next/link";
import { getEnquiries } from "@/lib/actions/coach";
import { formatDate } from "@/lib/audit-schedule";
import { EnquiryStatus } from "../EnquiryStatus";

// Coaching enquiries from the Coaching page, newest first, with a status.
export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "" } = await searchParams;
  const all = await getEnquiries();
  const shown = status ? all.filter((e) => e.status === status) : all;
  const count = (s: string) => all.filter((e) => e.status === s).length;

  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Enquiries</div>
      <h1>Coaching enquiries</h1>
      <p className="lead">From the Coaching page. Reply by email, then move each one along.</p>

      <nav className="admin-tabs" aria-label="Filter by status">
        {[["", `All ${all.length}`], ["new", `New ${count("new")}`], ["contacted", `Contacted ${count("contacted")}`], ["booked", `Booked ${count("booked")}`], ["closed", `Closed ${count("closed")}`]].map(([k, label]) => (
          <Link key={k} href={k ? `/coach/enquiries?status=${k}` : "/coach/enquiries"} aria-current={status === k ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">◇</span>
          {all.length ? "None with this status." : "No enquiries yet. They arrive here from the Coaching page."}
        </div>
      ) : (
        <ul className="enq-list">
          {shown.map((e) => (
            <li key={e.id} className={e.status === "new" ? "new" : undefined}>
              <div className="enq-head">
                <div>
                  <Link href={`/coach/clients/${e.client_id}`}><b>{e.name || "Unnamed"}</b></Link>
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
    </div>
  );
}
