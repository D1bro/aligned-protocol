import Link from "next/link";
import type { getClientProfile } from "@/lib/actions/admin";
import { formatSessionTime, toLocalParts } from "@/lib/time";
import { SessionBooking } from "./SessionBooking";
import { SessionActions } from "./SessionActions";

type Profile = Awaited<ReturnType<typeof getClientProfile>>;

export const STATE_LABEL: Record<string, string> = {
  proposed: "Proposed",
  confirmed: "Confirmed",
  held: "Held",
  cancelled: "Cancelled",
  no_show: "No-show",
};

// Sessions: upcoming and past conversations, each with its own actions and
// history. Counts never include cancelled or rescheduled-away times.
export function SessionsTab({ p }: { p: Profile }) {
  const { sessions, events, summaries } = p.coaching;
  const now = Date.now();
  const upcoming = sessions
    .filter((s) => (s.state === "proposed" || s.state === "confirmed"))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = sessions.filter((s) => !(s.state === "proposed" || s.state === "confirmed"));

  const summaryState = (sessionId: string) => {
    const mine = summaries.filter((x) => x.session_id === sessionId);
    const pub = mine.find((x) => x.status === "published");
    const draft = mine.find((x) => x.status === "draft" || x.status === "approved");
    if (pub && draft) return `Shared (revision ${pub.revision}) · newer draft`;
    if (pub) return `Shared (revision ${pub.revision})`;
    if (draft) return draft.status === "approved" ? "Summary approved, not shared" : "Summary draft";
    return "No summary";
  };

  const row = (s: (typeof sessions)[number]) => {
    const ev = events.filter((e) => e.session_id === s.id);
    const moves = ev.filter((e) => e.kind === "rescheduled");
    const local = toLocalParts(s.scheduled_at, s.timezone);
    const overdue = (s.state === "proposed" || s.state === "confirmed") && new Date(s.scheduled_at).getTime() < now;
    return (
      <li key={s.id} className="cs-row">
        <div className="cs-row-head">
          <div>
            <b>{formatSessionTime(s.scheduled_at, s.timezone)}</b>
            <span className={`cs-state ${s.state}`}>{STATE_LABEL[s.state]}</span>
            {overdue ? <span className="cs-state overdue">Time has passed — mark held, no-show or cancelled</span> : null}
          </div>
          <Link href={`/coach/clients/${p.client.id}/sessions/${s.id}?stage=${s.state === "held" ? "import" : "prepare"}`} className="au-text-link">
            {s.state === "held" ? "Summarise" : "Prepare"} →
          </Link>
        </div>
        <p className="cs-meta">
          {s.duration_minutes} minutes{s.location ? ` · ${s.location}` : ""} · {summaryState(s.id)}
          {s.cancel_reason ? ` · Reason: ${s.cancel_reason}` : ""}
          {s.no_show_decision ? ` · Decision: ${s.no_show_decision}` : ""}
        </p>
        <SessionActions sessionId={s.id} state={s.state} localDate={local.date} localTime={local.time} />
        {moves.length ? (
          <details className="cs-history">
            <summary>Moved {moves.length} time{moves.length === 1 ? "" : "s"}</summary>
            <ul>
              {moves.map((m) => (
                <li key={m.id}>
                  {m.from_at ? formatSessionTime(m.from_at) : "?"} → {m.to_at ? formatSessionTime(m.to_at) : "?"}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </li>
    );
  };

  return (
    <section aria-label="Sessions">
      <div className="cs-top">
        <SessionBooking clientId={p.client.id} />
      </div>
      <h2 className="sec-head">Upcoming</h2>
      {upcoming.length ? <ul className="cs-list">{upcoming.map(row)}</ul> : <p className="cp-sub">No upcoming sessions.</p>}
      <h2 className="sec-head">History</h2>
      {past.length ? <ul className="cs-list">{past.map(row)}</ul> : <p className="cp-sub">No past sessions yet.</p>}
    </section>
  );
}
