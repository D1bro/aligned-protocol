import Link from "next/link";
import type { MemberCoaching as Data } from "@/lib/actions/member-coaching";
import { formatDate } from "@/lib/audit-schedule";
import { formatSessionTime } from "@/lib/time";
import { ProgressReport } from "./ProgressReport";
import { PrepEditor } from "./PrepEditor";

const PROGRESS: Record<string, string> = { tried: "Tried it", partly: "Partly", done: "Done", not_yet: "Not yet" };
type Content = {
  focus?: string;
  summary?: string;
  insights?: string[];
  resources?: { title: string; url: string }[];
  next_meeting?: { text?: string };
};

// The member's coaching space: last session, next steps, preparation, and
// links to their own audit and plan. Only what their coach has shared.
export function MemberCoaching({ data }: { data: Data }) {
  const now = Date.now();
  const next =
    data.sessions
      .filter((s) => (s.state === "confirmed" || s.state === "proposed") && new Date(s.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null;
  const last = data.summaries[0] ?? null;
  const c = (last?.content ?? {}) as Content;
  const steps = last ? data.commitments.filter((x) => x.summary_id === last.id) : [];
  const mine = steps.filter((x) => x.owner === "client");
  const theirs = steps.filter((x) => x.owner === "coach");
  const latestUpdate = (id: string) => data.updates.find((u) => u.commitment_id === id) ?? null;
  const draft = data.drafts.find((d) => d.session_id === (next?.id ?? null)) ?? data.drafts.find((d) => !d.session_id) ?? null;
  const lastShare = data.shares.find((s) => s.session_id === (next?.id ?? null)) ?? null;
  const earlier = data.summaries.slice(1);

  return (
    <section className="mc" aria-labelledby="mc-h">
      <h2 id="mc-h" className="mc-title">Your coaching</h2>

      <div className="mc-grid">
        <div className="admin-card">
          <h3>Next meeting</h3>
          {next ? (
            <>
              <p className="ov-big">{formatSessionTime(next.scheduled_at, next.timezone)}</p>
              <p className="admin-card-sub">
                {next.state === "confirmed" ? "Confirmed" : "Proposed — to be confirmed"} · {next.duration_minutes} minutes
                {next.location ? ` · ${next.location}` : ""}
              </p>
            </>
          ) : (
            <p className="admin-card-sub">{c.next_meeting?.text ? `Proposed: ${c.next_meeting.text} (not booked yet)` : "Nothing booked yet."}</p>
          )}
        </div>

        <div className="admin-card">
          <h3>Your audit and plan</h3>
          <p className="admin-card-sub">Your coach works from the same audit and plan you see here.</p>
          <p>
            <Link href="/audit/results" className="au-text-link">My snapshot</Link> · <Link href="/clear" className="au-text-link">My plan</Link>
          </p>
        </div>
      </div>

      <div className="admin-card mc-last">
        <h3>Our last session</h3>
        {last ? (
          <>
            <p className="admin-card-sub">Shared {formatDate(last.published_at)}</p>
            {c.focus ? <p className="mc-focus">{c.focus}</p> : null}
            {c.summary ? <p className="sw-p">{c.summary}</p> : null}
            {c.insights?.length ? (
              <>
                <h4>What you noticed</h4>
                <ul>{c.insights.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </>
            ) : null}
            {c.resources?.length ? (
              <>
                <h4>Resources</h4>
                <ul>{c.resources.map((r, i) => <li key={i}>{r.url ? <a href={r.url}>{r.title}</a> : r.title}</li>)}</ul>
              </>
            ) : null}
          </>
        ) : (
          <p className="admin-card-sub">Your coach hasn&rsquo;t shared a session summary yet.</p>
        )}
      </div>

      {mine.length || theirs.length ? (
        <div className="admin-card">
          <h3>My next steps</h3>
          <ul className="mc-steps">
            {mine.map((s) => {
              const u = latestUpdate(s.id);
              return (
                <li key={s.id}>
                  <p>{s.body}{s.due_date ? <em> · by {formatDate(s.due_date)}</em> : null}</p>
                  <em>
                    {u ? `You said: ${PROGRESS[u.progress] ?? u.progress}, ${formatDate(u.created_at)}${u.note ? ` — “${u.note}”` : ""}` : "No update yet"}
                  </em>
                  <ProgressReport commitmentId={s.id} />
                </li>
              );
            })}
          </ul>
          {theirs.length ? (
            <>
              <h4>What your coach will do</h4>
              <ul>{theirs.map((s) => <li key={s.id}>{s.body}{s.status === "done" ? <em> · done</em> : null}</li>)}</ul>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="admin-card">
        <h3>Before we meet</h3>
        <p className="admin-card-sub">Write anything you&rsquo;d like to bring. It stays private until you share it.</p>
        <PrepEditor sessionId={next?.id ?? null} initial={draft?.content ?? ""} lastShared={lastShare ? formatDate(lastShare.shared_at) : null} />
      </div>

      {earlier.length ? (
        <div className="admin-card">
          <h3>Earlier sessions</h3>
          <ul className="mc-earlier">
            {earlier.map((s) => (
              <li key={s.id}>
                <Link href={`/coaching/sessions/${s.session_id}`}>{(s.content as Content).focus || "Session summary"}</Link>
                <em> · shared {formatDate(s.published_at)}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
