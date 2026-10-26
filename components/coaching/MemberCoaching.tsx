import Link from "next/link";
import type { MemberCoaching as Data } from "@/lib/actions/member-coaching";
import { formatDate } from "@/lib/audit-schedule";
import { sessionDayTime } from "@/lib/time";
import { stepStates, stepTally } from "@/lib/momentum";
import { StepCheck } from "./StepCheck";
import { MomentumStrip } from "./Momentum";
import { PrepEditor } from "./PrepEditor";

const PROGRESS: Record<string, string> = { tried: "Tried it", partly: "Partly", done: "Done", not_yet: "Not yet" };
type Content = {
  focus?: string;
  summary?: string;
  insights?: string[];
  resources?: { title: string; url: string }[];
  next_meeting?: { text?: string };
  suggested_focus?: { area_id?: string; area_name?: string; goal?: string; why?: string };
};

// The member's coaching space: their momentum, the steps to tick off, the
// last session, preparation, and links to their own audit and plan. Only what
// their coach has shared.
export function MemberCoaching({
  data,
  sessionsLeft = null,
}: {
  data: Data;
  // Paid sessions left to book, with where to top up (null before billing is set up).
  sessionsLeft?: { available: number; href: string } | null;
}) {
  const now = Date.now();
  const next =
    data.sessions
      .filter((s) => (s.state === "confirmed" || s.state === "proposed") && new Date(s.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null;
  const last = data.summaries[0] ?? null;
  const c = (last?.content ?? {}) as Content;
  const steps = last ? data.commitments.filter((x) => x.summary_id === last.id) : [];
  const mine = steps.filter((x) => x.owner === "client" && x.status !== "dropped");
  const states = stepStates(mine, data.updates);
  const tally = stepTally(states);
  const lastSession = last ? data.sessions.find((s) => s.id === last.session_id) ?? null : null;
  const theirs = steps.filter((x) => x.owner === "coach");
  const latestUpdate = (id: string) => data.updates.find((u) => u.commitment_id === id) ?? null;
  const draft = data.drafts.find((d) => d.session_id === (next?.id ?? null)) ?? data.drafts.find((d) => !d.session_id) ?? null;
  const lastShare = data.shares.find((s) => s.session_id === (next?.id ?? null)) ?? null;
  const earlier = data.summaries.slice(1);

  return (
    <section className="mc" aria-labelledby="mc-h">
      <h2 id="mc-h" className="mc-title">Your coaching</h2>

      <MomentumStrip
        next={next}
        proposed={c.next_meeting?.text ?? null}
        sessionsLeft={sessionsLeft}
        states={states}
        updates={data.updates}
      />

      {mine.length || theirs.length ? (
        <div className="admin-card">
          <div className="mc-steps-head">
            <h3>Your next steps</h3>
            {last ? (
              <span className="admin-card-sub">
                From your session on {lastSession ? sessionDayTime(lastSession.scheduled_at, lastSession.timezone).replace(/ at .*/, "") : formatDate(last.published_at)}
              </span>
            ) : null}
          </div>
          <ul className="mc-checks">
            {mine.map((s, i) => {
              const u = latestUpdate(s.id);
              return (
                <li key={s.id} className={states[i] === "done" ? "mc-check is-done" : "mc-check"}>
                  <span className="mc-tick" aria-hidden="true">✓</span>
                  <div>
                    <p>{s.body}</p>
                    <em>
                      {s.due_date ? `By ${formatDate(s.due_date)} · ` : ""}
                      {u ? `You said: ${PROGRESS[u.progress] ?? u.progress}, ${formatDate(u.created_at)}${u.note ? ` — “${u.note}”` : ""}` : "No update yet"}
                    </em>
                    <StepCheck key={u?.id ?? "none"} commitmentId={s.id} current={u?.progress ?? null} />
                  </div>
                </li>
              );
            })}
          </ul>
          {tally.total && tally.moved === tally.total ? (
            <p className="mc-cele">
              {tally.total === 1 ? "Your step has" : tally.total === 2 ? "Both steps have" : `All ${tally.total} steps have`} moved. Tell your coach how it went in{" "}
              <a href="#before-we-meet" className="au-text-link">Before we meet</a>, so your next session starts where you are.
            </p>
          ) : null}
          {theirs.length ? (
            <>
              <h4>What your coach will do</h4>
              <ul>{theirs.map((s) => <li key={s.id}>{s.body}{s.status === "done" ? <em> · done</em> : null}</li>)}</ul>
            </>
          ) : null}
        </div>
      ) : null}

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
            {c.suggested_focus?.area_id ? (
              <div className="mc-suggest">
                <h4>Where to start</h4>
                <p>
                  Your coach suggests starting with <b>{c.suggested_focus.area_name}</b>
                  {c.suggested_focus.goal ? <>, with a first goal like &ldquo;{c.suggested_focus.goal}&rdquo;</> : null}.
                </p>
                {c.suggested_focus.why ? <p className="sw-p">{c.suggested_focus.why}</p> : null}
                <p>
                  <Link href={`/clear?choose=1&suggested=${encodeURIComponent(c.suggested_focus.area_id)}`} className="btn btn-o">
                    Choose where to start →
                  </Link>
                </p>
                <p className="admin-card-sub">It&rsquo;s your choice: pick this area or another in My plan.</p>
              </div>
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

      <div className="admin-card" id="before-we-meet">
        <h3>Before we meet</h3>
        <p className="admin-card-sub">Write anything you&rsquo;d like to bring. It stays private until you share it.</p>
        <PrepEditor sessionId={next?.id ?? null} initial={draft?.content ?? ""} lastShared={lastShare ? formatDate(lastShare.shared_at) : null} />
      </div>

      <div className="admin-card">
        <h3>Your audit and plan</h3>
        <p className="admin-card-sub">Your coach works from the same audit and plan you see here.</p>
        <p>
          <Link href="/audit/results" className="au-text-link">My snapshot</Link> · <Link href="/clear" className="au-text-link">My plan</Link>
        </p>
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
