import Link from "next/link";
import type { MemberCoaching } from "@/lib/actions/member-coaching";
import { formatDate } from "@/lib/audit-schedule";
import { formatSessionTime } from "@/lib/time";
import { ProgressReport } from "@/components/coaching/ProgressReport";
import { IconBadge } from "@/components/ui/Icon";

const PROGRESS: Record<string, string> = { tried: "Tried it", partly: "Partly", done: "Done", not_yet: "Not yet" };
const SHOWN = 5;

type Suggestion = { area_id?: string; area_name?: string; goal?: string };

// My profile, for coaching clients: the next session, the steps agreed at
// the last shared session (with "how's it going"), and the coach's suggested
// place to start until they've set a goal. The full detail stays on the
// Coaching page; this is the at-a-glance version. Shows nothing for members
// without coaching.
export function CoachingCard({
  data,
  goals,
  hasGoal,
  credits = null,
}: {
  data: MemberCoaching;
  goals: { id: string; title: string }[];
  hasGoal: boolean;
  // Sessions paid for and not yet used (null before billing is set up).
  credits?: { available: number; reserved: number } | null;
}) {
  if (!data.available || (!data.sessions.length && !data.summaries.length)) return null;
  const now = Date.now();
  const next =
    data.sessions
      .filter((s) => (s.state === "confirmed" || s.state === "proposed") && new Date(s.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null;
  const last = data.summaries[0] ?? null;
  const steps = last ? data.commitments.filter((c) => c.summary_id === last.id && c.owner === "client" && c.status === "open") : [];
  const latest = (id: string) => data.updates.find((u) => u.commitment_id === id) ?? null;
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  const suggestion = ((last?.content ?? {}) as { suggested_focus?: Suggestion }).suggested_focus;
  const joinUrl = next?.location && /^https?:\/\//.test(next.location) ? next.location : null;

  return (
    <section className="profile-card coaching-card" aria-labelledby="coaching-card-h">
      <div className="coaching-card-head">
        <h2 id="coaching-card-h"><IconBadge name="chat" size={15} /> From your coaching</h2>
        <Link href="/coaching" className="au-text-link">Coaching page</Link>
      </div>

      <div className="coaching-next">
        <p className="profile-card-k">Next session</p>
        {next ? (
          <>
            <p className="coaching-next-time">{formatSessionTime(next.scheduled_at, next.timezone)}</p>
            <p className="admin-card-sub">
              {next.state === "confirmed" ? "Confirmed" : "Proposed — to be confirmed"} · {next.duration_minutes} minutes
              {next.location && !joinUrl ? ` · ${next.location}` : ""}
            </p>
            {joinUrl ? (
              <a href={joinUrl} className="btn btn-o coaching-join" target="_blank" rel="noopener noreferrer">Join the call →</a>
            ) : null}
          </>
        ) : (
          <p className="admin-card-sub">Nothing booked yet.</p>
        )}
        {credits ? (
          <p className="admin-card-sub coaching-credits">
            {credits.available} paid session{credits.available === 1 ? "" : "s"} left to book
            {credits.available <= 1 ? <> · <Link href="/coaching?tab=payments" className="au-text-link">Top up</Link></> : null}
          </p>
        ) : null}
      </div>

      {!hasGoal && suggestion?.area_id ? (
        <div className="mc-suggest">
          <p>
            Your coach suggests starting with <b>{suggestion.area_name}</b>
            {suggestion.goal ? <>, with a first goal like &ldquo;{suggestion.goal}&rdquo;</> : null}.
          </p>
          <p>
            <Link href={`/clear?choose=1&suggested=${encodeURIComponent(suggestion.area_id)}`} className="au-text-link">Choose where to start →</Link>
          </p>
        </div>
      ) : null}

      {steps.length ? (
        <div>
          <p className="profile-card-k">Your next steps{last ? ` · from ${formatDate(last.published_at)}` : ""}</p>
          <ul className="coaching-steps">
            {steps.slice(0, SHOWN).map((s) => {
              const u = latest(s.id);
              return (
                <li key={s.id}>
                  <p>{s.body}</p>
                  <em>
                    {s.due_date ? `By ${formatDate(s.due_date)} · ` : ""}
                    {s.goal_id && goalTitle.has(s.goal_id) ? `For “${goalTitle.get(s.goal_id)}” · ` : ""}
                    {u ? `${PROGRESS[u.progress] ?? u.progress}, ${formatDate(u.created_at)}` : "No update yet"}
                  </em>
                  <ProgressReport commitmentId={s.id} />
                </li>
              );
            })}
          </ul>
          {steps.length > SHOWN ? (
            <p className="profile-card-foot">
              {steps.length - SHOWN} more on your <Link href="/coaching" className="au-text-link">Coaching page</Link>
            </p>
          ) : null}
        </div>
      ) : last ? (
        <p className="admin-card-sub">No open steps from your last session.</p>
      ) : (
        <p className="admin-card-sub">Your coach&rsquo;s notes and your next steps appear here after your first session.</p>
      )}
    </section>
  );
}
