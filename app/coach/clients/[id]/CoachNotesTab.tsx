import type { getClientProfile } from "@/lib/actions/admin";
import { formatDate } from "@/lib/audit-schedule";
import { formatSessionTime } from "@/lib/time";
import { NoteEditor } from "./NoteEditor";

type Profile = Awaited<ReturnType<typeof getClientProfile>>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// Coach notes: private working notes, by session and over time. Never shown
// to the member and never included in anything shared with them.
export function CoachNotesTab({ p }: { p: Profile }) {
  const { notes, sessions } = p.coaching;
  const general = notes.filter((n) => !n.session_id && n.author_id === p.viewer.id);
  const bySession = notes.filter((n) => n.session_id);
  const sessionLabel = (id: string | null) => {
    const s = sessions.find((x) => x.id === id);
    return s ? formatSessionTime(s.scheduled_at, s.timezone) : "Session";
  };

  return (
    <section aria-label="Coach notes">
      <p className="cp-sub">
        Private to you and this client&rsquo;s assigned coach. Nothing here is shared with {p.client.full_name?.split(" ")[0] || "the client"}.
      </p>
      <div className="admin-card">
        <h2>Working notes</h2>
        <NoteEditor clientId={p.client.id} sessionId={null} initial={general[0] ?? null} label="General note about this client" />
      </div>

      <h2 className="sec-head">Session notes</h2>
      {bySession.length ? (
        <ul className="cs-list">
          {bySession.map((n) => (
            <li key={n.id} className="cs-row">
              <div className="cs-row-head">
                <b>{sessionLabel(n.session_id)}</b>
                <span className="cp-sub">Updated {formatDate(n.updated_at)}</span>
              </div>
              {n.author_id === p.viewer.id ? (
                <NoteEditor clientId={p.client.id} sessionId={n.session_id} initial={n} label="Note" />
              ) : (
                <p className="cs-note">{n.body || "(empty)"}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="cp-sub">No session notes yet. Each session&rsquo;s desk has its own note.</p>
      )}

      {p.notes.length ? (
        <>
          <h2 className="sec-head">Earlier notes</h2>
          <p className="cp-sub">From before sessions were tracked. They aren&rsquo;t linked to a session or counted as attendance.</p>
          <ol className="checkin-list">
            {p.notes.map((n) => (
              <li key={n.id as string}>
                <div className="checkin-head">
                  <b>{formatDate(n.session_date as string)}</b>
                  {str(n.focus) ? <span>{str(n.focus)}</span> : null}
                </div>
                <p>{str(n.note)}</p>
                {str(n.next_actions) ? <p><span>Next:</span> {str(n.next_actions)}</p> : null}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
