"use client";

import { useState } from "react";
import { setMoveDone, setMoveTick, type Move } from "@/lib/actions/next-step";
import { daysLabel, moveDays, type LogDay } from "@/lib/daily-log";

const DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// A Next Step's moves, the daily log in place: a repeating move shows its
// week (a dot for each day it's planned or was done) and today's tick; a
// one-off is ticked off once. `weeks`: each move's days this week.
export function Moves({ moves, weeks = {}, readOnly = false }: { moves: Move[]; weeks?: Record<string, LogDay[]>; readOnly?: boolean }) {
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      moves.map((m) => [m.id, moveDays(m.when_text).length ? !!weeks[m.id]?.find((d) => d.today)?.done : !!m.done_at])
    )
  );
  const [error, setError] = useState<string | null>(null);

  async function toggle(m: Move) {
    const next = !done[m.id];
    setDone((d) => ({ ...d, [m.id]: next }));
    setError(null);
    const res = moveDays(m.when_text).length ? await setMoveTick(m.id, next) : await setMoveDone(m.id, next);
    if (!res.ok) {
      setDone((d) => ({ ...d, [m.id]: !next }));
      setError(res.message);
    }
  }

  return (
    <>
      <ul className="ns-move-list">
        {moves.map((m) => {
          const days = moveDays(m.when_text);
          const week = weeks[m.id] ?? [];
          const plannedToday = days.length ? !!week.find((d) => d.today)?.planned : true;
          const ticked = done[m.id];
          return (
            <li key={m.id} className={!days.length && ticked ? "done" : undefined}>
              {readOnly || (days.length && !plannedToday && !ticked) ? (
                <span className="ns-tick" aria-hidden="true" />
              ) : (
                <input
                  type="checkbox"
                  id={`mv-${m.id}`}
                  checked={!!ticked}
                  onChange={() => toggle(m)}
                  aria-label={days.length ? `${m.body}: done today` : `${m.body}: done`}
                />
              )}
              <label htmlFor={readOnly ? undefined : `mv-${m.id}`}>
                <span className="ns-move-body">{m.body}</span>
                {days.length ? <span className="ns-move-when"> · {daysLabel(days)}</span> : m.when_text ? <span className="ns-move-when"> · {m.when_text}</span> : null}
              </label>
              {days.length && week.length ? (
                <ol className="ns-move-week" aria-label={`This week: ${week.filter((d) => d.done).length} of ${week.filter((d) => d.planned).length} planned days done`}>
                  {week.map((d, i) => (
                    <li
                      key={d.date}
                      className={[(d.today ? ticked : d.done) ? "d" : "", d.planned ? "p" : "", d.today ? "t" : ""].filter(Boolean).join(" ") || undefined}
                      title={`${DAY[i]}${d.planned ? ", planned" : ""}${d.done ? ", done" : ""}`}
                    >
                      {d.letter}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </>
  );
}
