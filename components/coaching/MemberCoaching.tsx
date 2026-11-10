import Link from "next/link";
import type { MemberCoaching as Data } from "@/lib/actions/member-coaching";
import { formatDate } from "@/lib/audit-schedule";
import { sessionDayTime } from "@/lib/time";
import { stepStates, stepTally } from "@/lib/momentum";
import { StepCheck } from "./StepCheck";
import { MomentumStrip } from "./Momentum";
import { PrepEditor } from "./PrepEditor";
import type { GoalCard } from "@/lib/actions/member-coaching";
import type { CalibratedArea } from "@/lib/calibration";

const PROGRESS: Record<string, string> = { tried: "Tried it", partly: "Partly", done: "Done", not_yet: "Not yet" };
type Content = {
  focus?: string;
  summary?: string;
  insights?: string[];
  resources?: { title: string; url: string }[];
  next_meeting?: { text?: string };
  suggested_focus?: { area_id?: string; area_name?: string; goal?: string; why?: string };
};

type Chart = { sharedAt: string; areas: (CalibratedArea & { name: string })[] };

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

// The member's coaching dashboard: when (next session, sessions left,
// momentum), how the steps from the last session are going (each linked to
// the goal it serves), their goals, the last session in brief beside their
// calibrated chart, preparing for the next session, and the sessions so far.
// Only what their coach has shared.
export function MemberCoaching({
  data,
  sessionsLeft = null,
  goals = [],
  chart = null,
  auditDone = false,
}: {
  data: Data;
  // Paid sessions left to book, with where to top up (null before billing is set up).
  sessionsLeft?: { available: number; href: string } | null;
  goals?: GoalCard[];
  chart?: Chart | null;
  // Whether they've completed The Aligned Protocol (for Getting started).
  auditDone?: boolean;
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
  const goalOf = new Map(goals.map((g) => [g.id, g]));
  const stepsFor = (goalId: string) => mine.filter((x) => x.goal_id === goalId).length;
  const summaryOf = new Map(data.summaries.map((x) => [x.session_id, x]));
  const timeline = data.sessions
    .filter((s) => s.state === "held" || ((s.state === "confirmed" || s.state === "proposed") && new Date(s.scheduled_at).getTime() >= now))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const lastDay = lastSession ? sessionDayTime(lastSession.scheduled_at, lastSession.timezone).replace(/ at .*/, "") : last ? formatDate(last.published_at) : "";
  const agreedChanged = chart ? chart.areas.filter((a) => a.agreed !== null && (a.focus || a.alone !== a.agreed)) : [];

  // Before the first session is held: one "Getting started" card and the
  // preparation, instead of a dashboard of empty cards (Duane, 9 Nov 2026).
  const started = data.sessions.some((s) => s.state === "held") || data.summaries.length > 0;
  if (!started) {
    const joinUrl = next?.location && /^https?:\/\//.test(next.location) ? next.location : null;
    const items: { done: boolean; title: string; body: React.ReactNode }[] = [
      {
        done: !!next && next.state === "confirmed",
        title: "Your first session",
        body: next ? (
          <>
            {sessionDayTime(next.scheduled_at, next.timezone)} · {next.duration_minutes} minutes
            {next.state === "confirmed" ? "" : " · to be confirmed"}
            {joinUrl ? <> · <a href={joinUrl} className="au-text-link" target="_blank" rel="noopener noreferrer">Join link</a></> : null}
          </>
        ) : (
          "Your coach will be in touch to arrange it."
        ),
      },
      {
        done: auditDone,
        title: "Take The Aligned Protocol",
        body: auditDone ? (
          <>Done. Your coach starts from the same chart you see. <Link href="/audit/results" className="au-text-link">My snapshot</Link></>
        ) : (
          <>Score the ten areas of your life on your own, so you both start from where you are. <Link href="/audit" className="au-text-link">Start →</Link></>
        ),
      },
      {
        done: goals.length > 0,
        title: "Choose where to start in The Next Step",
        body: goals.length ? (
          <>Your Next Step: {goals[0].title} <Link href="/next-step" className="au-text-link">The Next Step</Link></>
        ) : (
          <>Pick one area and set your Next Step. You can change it together in the session. <Link href="/next-step" className="au-text-link">Open The Next Step →</Link></>
        ),
      },
      {
        done: !!lastShare,
        title: "Tell your coach what’s on your mind",
        body: lastShare ? (
          `Shared ${formatDate(lastShare.shared_at)}. You can add more below.`
        ) : (
          <>A few lines on what you&rsquo;d like from coaching. <a href="#before-we-meet" className="au-text-link">Write it below</a></>
        ),
      },
    ];
    const doneCount = items.filter((i) => i.done).length;
    return (
      <section className="mc mcd" aria-labelledby="mc-h">
        <h2 id="mc-h" className="mc-title">Your coaching</h2>
        <div className="admin-card mcd-start">
          <div className="mc-steps-head">
            <h3>Getting started</h3>
            <span className="admin-card-sub">{doneCount} of {items.length} ready</span>
          </div>
          <ol>
            {items.map((i) => (
              <li key={i.title} className={i.done ? "is-done" : undefined}>
                <span className="mc-tick" aria-hidden="true">✓</span>
                <div>
                  <b>{i.title}</b>
                  <p>{i.body}</p>
                </div>
              </li>
            ))}
          </ol>
          {sessionsLeft && !sessionsLeft.available ? (
            <p className="admin-card-sub">
              No paid sessions yet · <Link href={sessionsLeft.href} className="au-text-link">See sessions and payments</Link>
            </p>
          ) : null}
        </div>
        <div className="admin-card" id="before-we-meet">
          <h3>Before we meet{next ? ` on ${sessionDayTime(next.scheduled_at, next.timezone).replace(/ at .*/, "")}` : ""}</h3>
          <p className="admin-card-sub">What&rsquo;s on your mind, and what would make the session useful? It stays private until you share it.</p>
          <PrepEditor sessionId={next?.id ?? null} initial={draft?.content ?? ""} lastShared={lastShare ? formatDate(lastShare.shared_at) : null} />
        </div>
      </section>
    );
  }

  return (
    <section className="mc mcd" aria-labelledby="mc-h">
      <h2 id="mc-h" className="mc-title">Your coaching</h2>

      <MomentumStrip next={next} proposed={c.next_meeting?.text ?? null} sessionsLeft={sessionsLeft} states={states} updates={data.updates} />

      {tally.total ? (
        <p className={tally.done === tally.total ? "mcd-progress is-all" : "mcd-progress"} role="status">
          Since our last session: <b>{tally.done} of {tally.total} step{tally.total === 1 ? "" : "s"} done</b>
          {tally.moved > tally.done ? ` · ${tally.moved - tally.done} under way` : ""}
        </p>
      ) : null}

      <div className="mcd-two">
        <div className="admin-card">
          <div className="mc-steps-head">
            <h3>Your next steps</h3>
            {last ? <span className="admin-card-sub">From {lastDay}</span> : null}
          </div>
          {mine.length ? (
            <ul className="mc-checks">
              {mine.map((s, i) => {
                const u = latestUpdate(s.id);
                const g = s.goal_id ? goalOf.get(s.goal_id) : null;
                return (
                  <li key={s.id} className={states[i] === "done" ? "mc-check is-done" : "mc-check"}>
                    <span className="mc-tick" aria-hidden="true">✓</span>
                    <div>
                      <p>{s.body}</p>
                      {g ? <Link href="/next-step" className="mcd-chip">{g.area ?? "Your goal"}</Link> : null}
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
          ) : (
            <p className="admin-card-sub">You&rsquo;ll agree your next steps together in a session.</p>
          )}
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

        <div className="admin-card">
          <h3>Your Next Steps</h3>
          {goals.length ? (
            <ul className="mcd-goals">
              {goals.map((g) => (
                <li key={g.id}>
                  <span className="admin-card-sub">{g.area ?? "Goal"}{g.main ? " · main goal" : ""}</span>
                  <b>{g.title}</b>
                  <span className="mcd-goal-meta">
                    {g.now !== null ? `${g.now}/10 now` : ""}
                    {g.now !== null && g.target !== null ? " → " : ""}
                    {g.target !== null ? `aiming for ${g.target}` : ""}
                    {stepsFor(g.id) ? ` · ${stepsFor(g.id)} step${stepsFor(g.id) === 1 ? "" : "s"} from your session` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-card-sub">Your Next Steps appear here once you&rsquo;ve set one.</p>
          )}
          <Link href="/next-step" className="au-text-link">Open The Next Step →</Link>
        </div>
      </div>

      <div className="mcd-two">
        <div className="admin-card mc-last">
          <h3>Our last session{last ? ` · ${lastDay}` : ""}</h3>
          {last ? (
            <>
              {c.focus ? <p className="mc-focus">{c.focus}</p> : null}
              {c.summary ? <p className="sw-p">{clip(c.summary, 280)}</p> : null}
              {c.suggested_focus?.area_id ? (
                <div className="mc-suggest">
                  <h4>Where to start</h4>
                  <p>
                    Your coach suggests starting with <b>{c.suggested_focus.area_name}</b>
                    {c.suggested_focus.goal ? <>, with a first goal like &ldquo;{c.suggested_focus.goal}&rdquo;</> : null}.
                  </p>
                  <p>
                    <Link href={`/next-step?choose=1&suggested=${encodeURIComponent(c.suggested_focus.area_id)}`} className="btn btn-o">
                      Choose where to start →
                    </Link>
                  </p>
                  <p className="admin-card-sub">It&rsquo;s your choice: pick this area or another in The Next Step.</p>
                </div>
              ) : null}
              <Link href={`/coaching/sessions/${last.session_id}`} className="au-text-link">Read the full notes →</Link>
            </>
          ) : (
            <p className="admin-card-sub">Your coach hasn&rsquo;t shared a session summary yet.</p>
          )}
        </div>

        <div className="admin-card">
          {chart ? (
            <>
              <h3>Your chart, taken further</h3>
              <p className="admin-card-sub">Agreed {formatDate(chart.sharedAt)}</p>
              <ul className="mcd-chart">
                {agreedChanged.map((a) => (
                  <li key={a.life_area_id}>
                    <span>{a.name}{a.focus ? <em> · focus</em> : null}</span>
                    <span>{a.alone !== null && a.alone !== a.agreed ? `${a.alone} on your own → ` : ""}<b>{a.agreed}</b></span>
                  </li>
                ))}
              </ul>
              <Link href="/journey" className="au-text-link">See it in My Journey →</Link>
            </>
          ) : (
            <>
              <h3>Your audit and plan</h3>
              <p className="admin-card-sub">Your coach works from the same audit and plan you see here.</p>
              <p>
                <Link href="/audit/results" className="au-text-link">My snapshot</Link> · <Link href="/next-step" className="au-text-link">The Next Step</Link>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="admin-card" id="before-we-meet">
        <h3>Before we meet{next ? ` on ${sessionDayTime(next.scheduled_at, next.timezone).replace(/ at .*/, "")}` : ""}</h3>
        <p className="admin-card-sub">What&rsquo;s on your mind, and what would make the session useful? It stays private until you share it.</p>
        <PrepEditor sessionId={next?.id ?? null} initial={draft?.content ?? ""} lastShared={lastShare ? formatDate(lastShare.shared_at) : null} />
      </div>

      {timeline.length ? (
        <div className="admin-card">
          <h3>Your sessions</h3>
          <ol className="mcd-timeline">
            {timeline.map((s) => {
              const done = s.state === "held";
              const sum = summaryOf.get(s.id);
              const label = sessionDayTime(s.scheduled_at, s.timezone).replace(/ at .*/, "");
              const title = (sum?.content as Content | undefined)?.focus;
              return (
                <li key={s.id} className={done ? "is-done" : "is-next"}>
                  <span className="mcd-dot" aria-hidden="true">{done ? "✓" : ""}</span>
                  {sum ? <Link href={`/coaching/sessions/${s.id}`}>{label}{title ? ` · ${clip(title, 40)}` : ""}</Link> : <span>{label}{s.id === next?.id ? " · next" : done ? "" : s.state === "proposed" ? " · to be confirmed" : " · booked"}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
