import Link from "next/link";
import type { getClientProfile } from "@/lib/actions/admin";
import { formatSessionTime, toLocalParts } from "@/lib/time";
import { SessionBooking } from "./SessionBooking";
import { SessionActions } from "./SessionActions";
import { NoShowCredit } from "./BillingActions";
import type { ClientBilling } from "@/lib/actions/billing";
import type { MessageJob } from "@/lib/actions/messages";
import { EmailButton } from "./EmailButton";

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
export function SessionsTab({ p, billing, jobs }: { p: Profile; billing: ClientBilling | null; jobs: MessageJob[] }) {
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

  // The automatic day-before reminder (sent by the daily job at about 8am UK time).
  const reminderLabel = (s: (typeof sessions)[number]) => {
    const job = jobs.find((j) => j.kind === "session_reminder" && j.dedupe_key === `reminder:${s.id}:${s.scheduled_at}`);
    if (job?.status === "sent") return `Reminder sent ${new Date(job.sent_at ?? job.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" })}`;
    if (job?.status === "failed") return "Reminder didn’t send";
    if (s.state === "confirmed" && new Date(s.scheduled_at).getTime() > Date.now()) return p.client.email ? "Reminder goes the day before" : "No email for a reminder";
    return null;
  };

  // What each session means for their paid sessions (after migration 0014).
  const creditLabel = (s: (typeof sessions)[number]) => {
    if (!billing?.available) return null;
    const r = billing.reservations.find((x) => x.session_id === s.id);
    if (r?.status === "consumed") return "Paid session used";
    if (r?.status === "active") return s.state === "no_show" ? "Credit on hold — decide below" : "Paid session reserved";
    if (s.state === "confirmed") return "Not covered by a paid session";
    return null;
  };

  const firstName = p.client.full_name?.trim().split(/\s+/)[0] || "them";
  // The email for a session is about its latest change (booked, moved, cancelled).
  const emailKey = (s: (typeof sessions)[number]) => {
    const latest = events.find((e) => e.session_id === s.id && ["created", "confirmed", "rescheduled", "cancelled"].includes(e.kind));
    return `session:${s.id}:${latest?.id ?? s.state}`;
  };

  const row = (s: (typeof sessions)[number]) => {
    const ev = events.filter((e) => e.session_id === s.id);
    const moves = ev.filter((e) => e.kind === "rescheduled");
    const local = toLocalParts(s.scheduled_at, s.timezone);
    const overdue = (s.state === "proposed" || s.state === "confirmed") && new Date(s.scheduled_at).getTime() < now;
    const desk = `/coach/clients/${p.client.id}/sessions/${s.id}?stage=${s.state === "held" ? "import" : "prepare"}`;
    return (
      <li key={s.id} className="cs-row">
        <div className="cs-row-head">
          <div>
            {/* The date opens the session too: the link on the right is easy to miss. */}
            <Link href={desk} className="cs-title-link"><b>{formatSessionTime(s.scheduled_at, s.timezone)}</b></Link>
            <span className={`cs-state ${s.state}`}>{STATE_LABEL[s.state]}</span>
            {overdue ? <span className="cs-state overdue">Time has passed — mark held, no-show or cancelled</span> : null}
          </div>
          <Link href={desk} className="au-text-link">
            {s.state === "held" ? "Summarise" : "Prepare"} →
          </Link>
        </div>
        <p className="cs-meta">
          {s.duration_minutes} minutes{s.location ? ` · ${s.location}` : ""} · {summaryState(s.id)}
          {s.cancel_reason ? ` · Reason: ${s.cancel_reason}` : ""}
          {s.no_show_decision ? ` · Decision: ${s.no_show_decision}` : ""}
          {creditLabel(s) ? ` · ${creditLabel(s)}` : ""}
          {reminderLabel(s) ? ` · ${reminderLabel(s)}` : ""}
        </p>
        {s.state === "no_show" && billing?.canBill && billing.reservations.some((x) => x.session_id === s.id && x.status === "active") ? (
          <NoShowCredit sessionId={s.id} clientId={p.client.id} />
        ) : null}
        <SessionActions sessionId={s.id} state={s.state} localDate={local.date} localTime={local.time} />
        {p.client.email && (s.state === "proposed" || s.state === "confirmed" || s.state === "cancelled") && !(s.state === "cancelled" && new Date(s.scheduled_at).getTime() < now) ? (
          <EmailButton
            kind="session_update"
            refId={s.id}
            label={`Email ${firstName} about this`}
            last={jobs.find((j) => j.dedupe_key.startsWith(emailKey(s))) ?? null}
          />
        ) : null}
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
        {billing?.available ? (
          <span className="cs-meta">
            Paid sessions available: <b>{billing.credits.available}</b>
            {billing.credits.reserved ? ` · ${billing.credits.reserved} reserved for booked sessions` : ""}
          </span>
        ) : null}
      </div>
      <h2 className="sec-head">Upcoming</h2>
      {upcoming.length ? <ul className="cs-list">{upcoming.map(row)}</ul> : <p className="cp-sub">No upcoming sessions.</p>}
      <h2 className="sec-head">History</h2>
      {past.length ? <ul className="cs-list">{past.map(row)}</ul> : <p className="cp-sub">No past sessions yet.</p>}
      {jobs.length ? (
        <>
          <h2 className="sec-head">Emails to {firstName}</h2>
          <ul className="bl-ledger">
            {jobs.map((j) => (
              <li key={j.id}>
                <span className={`cs-state ${j.status === "sent" ? "bl-paid" : j.status === "failed" ? "bl-overdue" : ""}`}>{j.status}</span>
                <span>{j.subject}{j.error ? ` · ${j.error}` : ""}</span>
                <span className="cs-meta">{new Date(j.sent_at ?? j.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
