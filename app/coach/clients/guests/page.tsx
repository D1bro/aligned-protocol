import Link from "next/link";
import { requireAdmin } from "@/lib/actions/admin";
import { getGuests } from "@/lib/actions/guests";
import { formatDate } from "@/lib/audit-schedule";
import { AUDIT_AREAS, GUEST_STATE_LABEL, IDLE_CHOICES, guestState, idleDaysOf, idleGuests, isProtected, type GuestState } from "@/lib/guests";
import { ClientTabs } from "../ClientTabs";
import { GuestCleanup, RemoveGuestButton } from "./GuestActions";

const SHOWN_MAX = 500;
const FILTERS: GuestState[] = ["finished", "started", "empty"];

const ago = (days: number) => (days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`);

// Admin: everyone who started the audit without an account, with a way to
// clear out the ones who never finished.
export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show } = await searchParams;
  const filter = FILTERS.includes(show as GuestState) ? (show as GuestState) : null;
  const res = await getGuests();

  const head = (
    <>
      <div className="eyebrow"><span className="eydot" /> Clients</div>
      <h1>Guests</h1>
      <p className="lead">
        People who started the audit without an account. Removing a guest deletes their sign-in and their answers for good.
        Anyone who asked about coaching or has a billing record is always kept.
      </p>
      <ClientTabs current="guests" isAdmin />
    </>
  );

  if (!res.ok) {
    return (
      <div className="page admin-page">
        {head}
        <p className="clear-err">Couldn&rsquo;t load guests: {res.message}</p>
      </div>
    );
  }

  const { guests, now } = res;
  const count = (s: GuestState) => guests.filter((g) => guestState(g) === s).length;
  const kept = guests.filter(isProtected).length;
  const counts = IDLE_CHOICES.map((days) => ({ days, n: idleGuests(guests, days, now).length }));
  const matching = filter ? guests.filter((g) => guestState(g) === filter) : guests;
  const shown = matching.slice(0, SHOWN_MAX);

  return (
    <div className="page admin-page">
      {head}

      <div className="cp-facts">
        <div><span>Guests</span><b>{guests.length}</b></div>
        <div><span>Finished</span><b>{count("finished")}</b></div>
        <div><span>Started, not finished</span><b>{count("started")}</b></div>
        <div><span>Not started</span><b>{count("empty")}</b></div>
        <div><span>Kept (coaching or billing)</span><b>{kept}</b></div>
      </div>

      <section className="admin-card" aria-label="Clear out old guests">
        <h2>Clear out old guests</h2>
        <p className="admin-card-sub">
          Removes guests who never finished the audit and haven&rsquo;t done anything since. Finished guests stay; remove them one at a time below if you need to.
        </p>
        <GuestCleanup counts={counts} />
      </section>

      <form className="admin-filters" method="get">
        <select name="show" defaultValue={filter ?? ""} aria-label="Show">
          <option value="">All guests</option>
          {FILTERS.map((f) => <option key={f} value={f}>{GUEST_STATE_LABEL[f]}</option>)}
        </select>
        <button type="submit" className="btn btn-g">Filter</button>
        {filter ? <Link href="/coach/clients/guests" className="au-text-link">Clear</Link> : null}
      </form>

      {shown.length ? (
        <div className="admin-table admin-generic gm-table" role="table" aria-label="Guests" style={{ ["--cols" as string]: 4 }}>
          <div className="admin-row head" role="row">
            <span role="columnheader">Guest</span>
            <span role="columnheader">Audit</span>
            <span role="columnheader">Last active</span>
            <span role="columnheader"><span className="sr-only">Remove</span></span>
          </div>
          {shown.map((g) => {
            const state = guestState(g);
            return (
              <div key={g.id} className="admin-row" role="row">
                <span role="cell" className="admin-who">
                  <Link href={`/coach/clients/${g.id}`}><b>Guest {g.id.slice(0, 8)}</b></Link>
                  <em>Started {formatDate(g.createdAt)}</em>
                  {g.enquiry ? <em className="admin-enq">Kept: asked about coaching</em> : null}
                  {g.billing ? <em className="admin-enq">Kept: has a billing record</em> : null}
                </span>
                <span role="cell">
                  {state === "finished" ? <>{g.score ?? 0}/100<em>Finished</em></>
                    : state === "started" ? <>{g.answered} of {AUDIT_AREAS}<em>Not finished</em></>
                    : <em>Not started</em>}
                </span>
                <span role="cell">{ago(idleDaysOf(g, now))}<em>Last active</em></span>
                <span role="cell" className="gm-action">
                  {isProtected(g) ? <em>Kept</em> : <RemoveGuestButton id={g.id} />}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">◇</span>
          {guests.length ? "No guests match." : "No guests right now."}
        </div>
      )}
      {matching.length > SHOWN_MAX ? (
        <p className="admin-hint" style={{ marginTop: ".8rem", fontSize: "13px" }}>
          Showing the {SHOWN_MAX} most recently active of {matching.length}.
        </p>
      ) : null}
    </div>
  );
}
