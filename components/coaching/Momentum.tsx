import Link from "next/link";
import { countdown, daysUntil, shortDayTime, stepTally, weekStreak, type StepState } from "@/lib/momentum";

type Session = { scheduled_at: string; timezone: string; duration_minutes: number; state: string; location: string | null };

// One bar segment per step: half filled when tried or partly, full when done.
export function StepBar({ states }: { states: StepState[] }) {
  const t = stepTally(states);
  return (
    <div className="mo-seg" role="img" aria-label={`${t.moved} of ${t.total} steps under way, ${t.done} done`}>
      {states.map((s, i) => <span key={i} className={`mo-seg-${s}`} />)}
    </div>
  );
}

// The last few weeks, filled where they updated a step (or, on My profile,
// did their weekly review).
export function WeekDots({ weeks, what = "Updated a step" }: { weeks: boolean[]; what?: string }) {
  const n = weeks.filter(Boolean).length;
  return (
    <div className="mo-weeks" role="img" aria-label={`${what} in ${n} of the last ${weeks.length} weeks`}>
      {weeks.map((on, i) => <span key={i} className={on ? "on" : undefined} />)}
    </div>
  );
}

// The strip at the top of the member's coaching: time to the next session,
// how far the last session's steps have moved, and their run of weeks.
export function MomentumStrip({
  next,
  proposed,
  sessionsLeft,
  states,
  updates,
}: {
  next: Session | null;
  // The next meeting the coach suggested in the summary, when none is booked.
  proposed: string | null;
  sessionsLeft: { available: number; href: string } | null;
  states: StepState[];
  updates: { created_at: string }[];
}) {
  const now = new Date();
  const tally = stepTally(states);
  const run = weekStreak(updates, now);
  const joinUrl = next?.location && /^https?:\/\//.test(next.location) ? next.location : null;
  const days = next ? daysUntil(next.scheduled_at, next.timezone, now) : null;

  return (
    <div className="mo-strip">
      <div className="mo-tile">
        <p className="mo-k">Next session</p>
        {next && days !== null ? (
          <>
            <p className="mo-big">{countdown(days)}</p>
            <p className="mo-sub">
              {shortDayTime(next.scheduled_at, next.timezone)} · {next.duration_minutes} min
              {next.state === "confirmed" ? "" : " · to be confirmed"}
            </p>
            {joinUrl ? (
              <p className="mo-sub">
                <a href={joinUrl} className="mo-join" target="_blank" rel="noopener noreferrer">{days <= 0 ? "Join the call →" : "Join link ready"}</a>
              </p>
            ) : next.location ? (
              <p className="mo-sub">{next.location}</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mo-big">Not booked</p>
            <p className="mo-sub">{proposed ? `Proposed: ${proposed}` : "Your coach will arrange the next one."}</p>
          </>
        )}
        {sessionsLeft ? (
          <p className={sessionsLeft.available ? "mo-sub mo-small" : "mo-sub mo-small bs-low"}>
            {sessionsLeft.available
              ? `${sessionsLeft.available} paid session${sessionsLeft.available === 1 ? "" : "s"} left`
              : "No paid sessions left"}{" "}
            · <Link href={sessionsLeft.href} className="au-text-link">Top up</Link>
          </p>
        ) : null}
      </div>

      <div className="mo-tile">
        <p className="mo-k">Steps from last session</p>
        {tally.total ? (
          <>
            <p className="mo-big">{tally.moved} of {tally.total}</p>
            <p className="mo-sub">under way · {tally.done} done</p>
            <StepBar states={states} />
          </>
        ) : (
          <>
            <p className="mo-big">None yet</p>
            <p className="mo-sub">You&rsquo;ll agree your next steps in a session.</p>
          </>
        )}
      </div>

      <div className="mo-tile">
        <p className="mo-k">Momentum</p>
        {run.streak ? (
          <>
            <p className="mo-big">{run.streak} week{run.streak === 1 ? "" : "s"}</p>
            <p className="mo-sub">in a row you&rsquo;ve updated a step</p>
          </>
        ) : (
          <>
            <p className="mo-big">Start a run</p>
            <p className="mo-sub">Update a step this week to begin.</p>
          </>
        )}
        <WeekDots weeks={run.weeks} />
      </div>
    </div>
  );
}
