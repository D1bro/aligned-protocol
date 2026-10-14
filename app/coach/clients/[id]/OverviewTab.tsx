import Link from "next/link";
import type { getClientProfile } from "@/lib/actions/admin";
import { formatDate } from "@/lib/audit-schedule";
import { formatSessionTime } from "@/lib/time";

type Profile = Awaited<ReturnType<typeof getClientProfile>>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const PROGRESS: Record<string, string> = { tried: "Tried it", partly: "Partly", done: "Done", not_yet: "Not yet" };

// Overview: the person first. Their own words, their focus, what was agreed
// last time and what's happened since, and the one next step for the coach.
export function OverviewTab({
  p,
  firstName,
  mainGoal,
  focusNote,
  nextSession,
}: {
  p: Profile;
  firstName: string;
  mainGoal: Record<string, unknown> | null;
  focusNote: string | null;
  nextSession: Profile["coaching"]["sessions"][number] | null;
}) {
  const { coaching } = p;
  const published = coaching.summaries.filter((s) => s.status === "published");
  const lastShared = published[0] ?? null;
  const lastSharedSession = lastShared ? coaching.sessions.find((s) => s.id === lastShared.session_id) : null;
  const content = (lastShared?.content ?? {}) as { focus?: string; summary?: string };
  const agreed = lastShared ? coaching.commitments.filter((c) => c.summary_id === lastShared.id) : [];
  const latestUpdate = (id: unknown) => coaching.updates.find((u) => u.commitment_id === id) ?? null;
  const sharedSince = coaching.prepShares.filter(
    (s) => !lastShared?.published_at || new Date(s.shared_at as string) > new Date(lastShared.published_at as string)
  );
  const latestAudit = p.audits[0] ?? null;

  const own = [
    p.identityStatement ? { label: "Who they're becoming", text: p.identityStatement } : null,
    str(mainGoal?.motivation_text) ? { label: "Why their goal matters", text: str(mainGoal?.motivation_text)! } : null,
    focusNote ? { label: "Their audit note on this area", text: focusNote } : null,
  ].filter(Boolean) as { label: string; text: string }[];

  return (
    <div className="ov-grid">
      <section className="admin-card ov-matters" aria-labelledby="ov-matters-h">
        <h2 id="ov-matters-h">What matters to {firstName}</h2>
        {own.length ? (
          own.map((o) => (
            <blockquote key={o.label} className="ov-quote">
              <p>&ldquo;{o.text}&rdquo;</p>
              <cite>{o.label}</cite>
            </blockquote>
          ))
        ) : (
          <p className="admin-card-sub">Nothing in their own words yet. It will appear here once they write it in the app.</p>
        )}
      </section>

      <section className="admin-card ov-next" aria-labelledby="ov-next-h">
        <h2 id="ov-next-h">Next meeting</h2>
        {nextSession ? (
          <>
            <p className="ov-big">{formatSessionTime(nextSession.scheduled_at, nextSession.timezone)}</p>
            <p className="admin-card-sub">
              {nextSession.state === "confirmed" ? "Confirmed" : "Proposed — not confirmed yet"} · {nextSession.duration_minutes} minutes
              {nextSession.location ? ` · ${nextSession.location}` : ""}
            </p>
            <Link href={`/coach/clients/${p.client.id}/sessions/${nextSession.id}?stage=prepare`} className="btn btn-p">
              Prepare session →
            </Link>
          </>
        ) : (
          <>
            <p className="admin-card-sub">No meeting booked.</p>
            <Link href={`/coach/clients/${p.client.id}?tab=sessions`} className="btn btn-p">Book a session</Link>
          </>
        )}
      </section>

      <section className="admin-card" aria-labelledby="ov-focus-h">
        <h2 id="ov-focus-h">Current focus</h2>
        {mainGoal ? (
          <dl className="ov-facts">
            {str(mainGoal.focus_area) ? (<><dt>Area</dt><dd>{str(mainGoal.focus_area)}</dd></>) : null}
            <dt>Main goal</dt>
            <dd>{str(mainGoal.goal_title)}</dd>
            {str(mainGoal.action_text) ? (<><dt>Action</dt><dd>{str(mainGoal.action_text)}</dd></>) : null}
            {str(mainGoal.action_when) ?? str(mainGoal.frequency) ? (<><dt>When</dt><dd>{str(mainGoal.action_when) ?? str(mainGoal.frequency)}</dd></>) : null}
          </dl>
        ) : (
          <p className="admin-card-sub">No active goal. Their plan lives in My plan; nothing is set here for them.</p>
        )}
        <Link href={`/coach/clients/${p.client.id}?tab=goals`} className="au-text-link">Goals and audit</Link>
      </section>

      <section className="admin-card" aria-labelledby="ov-before-h">
        <h2 id="ov-before-h">Before we meet again</h2>
        {agreed.length ? (
          <ul className="ov-commit">
            {agreed.map((c) => {
              const u = latestUpdate(c.id);
              return (
                <li key={c.id as string}>
                  <span className={`ov-owner ${c.owner}`}>{c.owner === "client" ? firstName : "You"}</span>
                  <div>
                    <p>{str(c.body)}</p>
                    <em>
                      {c.owner === "client"
                        ? u
                          ? `${PROGRESS[u.progress as string] ?? u.progress} · ${formatDate(u.created_at as string)}${str(u.note) ? ` — “${str(u.note)}”` : ""}${u.support_requested ? " · asked for support" : ""}`
                          : "No update shared"
                        : c.status === "done"
                          ? "Done"
                          : c.due_date
                            ? `Due ${formatDate(c.due_date as string)}`
                            : "Open"}
                    </em>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="admin-card-sub">Nothing agreed yet. Commitments appear here once a session summary is shared.</p>
        )}
        {sharedSince.length ? (
          <div className="ov-prep">
            <p className="au-detail-k">Shared preparation · {formatDate(sharedSince[0].shared_at as string)}</p>
            <p>{str(sharedSince[0].content)}</p>
          </div>
        ) : null}
      </section>

      <section className="admin-card" aria-labelledby="ov-last-h">
        <h2 id="ov-last-h">Last shared summary</h2>
        {lastShared ? (
          <>
            <p className="admin-card-sub">
              {lastSharedSession ? formatSessionTime(lastSharedSession.scheduled_at, lastSharedSession.timezone) : ""} · shared{" "}
              {formatDate(lastShared.published_at as string)}
            </p>
            {content.focus ? <p><b>Focus:</b> {content.focus}</p> : null}
            {content.summary ? <p className="ov-summary">{content.summary}</p> : null}
            {lastSharedSession ? (
              <Link href={`/coach/clients/${p.client.id}/sessions/${lastSharedSession.id}?stage=review`} className="au-text-link">Open session</Link>
            ) : null}
          </>
        ) : (
          <p className="admin-card-sub">No summary shared yet.</p>
        )}
      </section>

      <section className="admin-card" aria-labelledby="ov-audit-h">
        <h2 id="ov-audit-h">Audit</h2>
        {latestAudit ? (
          <p>
            Latest {formatDate(latestAudit.completed_at)} · {latestAudit.total_score ?? 0}/100 <span className="admin-card-sub">(self-reported)</span>
          </p>
        ) : (
          <p className="admin-card-sub">No completed audit yet.</p>
        )}
        <Link href={`/coach/clients/${p.client.id}?tab=goals`} className="au-text-link">Life map and answers</Link>
      </section>
    </div>
  );
}
