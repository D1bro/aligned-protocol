import { addDays, countProgress, latestProgress, moveLog, type ActionUpdate, type LogMove, type MoveTick } from "@/lib/daily-log";
import { localDate } from "@/lib/time";
import { CloseActionButtons } from "./CloseActionButtons";

const CLOSER: Record<string, string> = { closer: "closer", same: "about the same", further: "further away" };
const PROGRESS: Record<string, string> = { tried: "tried it", partly: "partly", done: "done", not_yet: "not yet" };
const short = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

// "Since last time" on Prepare (Duane, 10 Nov 2026): the member's daily log
// since the last session, move by move (✓ ticked, ✗ planned and not ticked),
// "done when" counted, their "is it closer?" answers, and session actions
// from before the last session still open, to close or keep.
export function SinceLastTime({
  clientId,
  firstName,
  goal,
  moves,
  ticks,
  since,
  checkIns,
  olderOpen,
  updates,
}: {
  clientId: string;
  firstName: string;
  goal: { id: string; name: string; set_at: string | null; count_target: number | null; count_move_id: string | null } | null;
  moves: LogMove[];
  ticks: (MoveTick & { goal_id: string | null; source: string })[];
  // The day to start from: the last session held, or two weeks ago.
  since: string;
  checkIns: { created_at: string; closer: string | null; helped: string | null }[];
  olderOpen: { id: string; body: string; due_date: string | null; created_at: string }[];
  updates: ActionUpdate[];
}) {
  const today = localDate(new Date());
  const start = since > addDays(today, -27) ? since : addDays(today, -27);
  const days = Math.max(1, Math.min(28, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1));
  const day = (iso: string) => localDate(iso);
  const goalTicks = goal ? ticks.filter((t) => t.goal_id === goal.id && t.source === "move") : [];
  const logs = moves.map((m) => ({ move: m, log: moveLog(m, goalTicks, start, days, today, day) }));
  const count = goal ? countProgress(goal, goalTicks, goal.set_at ? day(goal.set_at) : null) : null;
  const countMove = goal ? moves.find((m) => m.id === goal.count_move_id) : null;
  const ticksSince = goalTicks.filter((t) => t.done_at && t.action_date >= start).length;

  return (
    <section className="admin-card" aria-labelledby="desk-since-h">
      <h2 id="desk-since-h">Since last time</h2>
      {goal ? (
        <>
          <div className="slt-head">
            <p className="admin-card-sub">{goal.name} · since {short(start)}</p>
            {count ? (
              <p className="slt-count"><b>{Math.min(count.done, count.target)} of {count.target}</b> towards done when{countMove ? ` (${countMove.body})` : ""}</p>
            ) : null}
          </div>
          {moves.length ? (
            <div className="slt-grid-wrap">
              <table className="slt-grid">
                <caption className="sr-only">{firstName}&rsquo;s ticks since {short(start)}</caption>
                <thead>
                  <tr>
                    <th scope="col">Move</th>
                    {logs[0].log.map((d) => (
                      <th key={d.date} scope="col" className={d.today ? "t" : undefined} title={short(d.date)}>{d.letter}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(({ move, log }) => (
                    <tr key={move.id}>
                      <th scope="row">{move.body}</th>
                      {log.map((d) => {
                        const missed = d.planned && !d.done && !d.future && !d.today;
                        return (
                          <td key={d.date} className={d.done ? "d" : missed ? "m" : d.planned ? "p" : undefined}>
                            {d.done ? "✓" : missed ? "✗" : d.planned ? "○" : ""}
                            <span className="sr-only">{short(d.date)}: {d.done ? "ticked" : missed ? "planned, not ticked" : d.planned ? "planned" : "not planned"}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="admin-card-sub">✓ ticked · ✗ planned, not ticked · ○ planned, still to come. {ticksSince ? `${ticksSince} tick${ticksSince === 1 ? "" : "s"} since ${short(start)}.` : `No ticks since ${short(start)}.`}</p>
            </div>
          ) : (
            <p className="admin-card-sub">No moves yet.</p>
          )}
          <h3 className="desk-h3">Is it closer?</h3>
          {checkIns.length ? (
            <ul className="slt-list">
              {checkIns.map((c) => (
                <li key={c.created_at}>
                  {short(day(c.created_at))} · <b>{CLOSER[c.closer ?? ""] ?? "answered"}</b>
                  {c.helped?.trim() ? <> &ldquo;{c.helped.trim()}&rdquo;</> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-card-sub">No check-ins since {short(start)}.</p>
          )}
        </>
      ) : (
        <p className="admin-card-sub">No Next Step under way.</p>
      )}
      {olderOpen.length ? (
        <>
          <h3 className="desk-h3">Still open from earlier sessions</h3>
          <p className="admin-card-sub">Close what&rsquo;s done or no longer fits, so {firstName}&rsquo;s list stays short. What you keep stays on it.</p>
          <ul className="slt-list slt-older">
            {olderOpen.map((a) => {
              const u = latestProgress(updates, a.id);
              return (
                <li key={a.id}>
                  <span>
                    {a.body}
                    <em> · agreed {short(day(a.created_at))}{a.due_date ? `, due ${short(a.due_date)}` : ""}{u ? ` · ${firstName}: ${PROGRESS[u.progress] ?? u.progress}` : ""}</em>
                  </span>
                  <CloseActionButtons clientId={clientId} commitmentId={a.id} />
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
