"use client";

import { useState } from "react";
import { DAY_NAMES, formatWhen, moveDate, moveDays, moveTime } from "@/lib/daily-log";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const localToday = () => new Date().toLocaleDateString("en-CA");

// When a move happens, picked rather than typed (Duane, 11 Nov 2026): it
// repeats on the days ticked, or happens once (by a date, if there is one),
// with an optional time. Writes the move's "when" in one form everywhere
// ("Weekdays · 8:55am"). Anything written before in other words is read
// back into the picker; a one-off it can't read is kept as written until
// they pick something else.
export function WhenPicker({ value, onChange, label, disabled }: { value: string; onChange: (v: string) => void; label: string; disabled?: boolean }) {
  const [today] = useState(localToday);
  const [state, setState] = useState(() => {
    const days = moveDays(value);
    const date = days.length ? null : moveDate(value, today);
    return {
      mode: (days.length || !value.trim() ? "repeat" : "once") as "repeat" | "once",
      days,
      time: moveTime(value),
      date,
      // A one-off in their own words ("When I'm paid"), kept until replaced.
      kept: !days.length && !date && value.trim() ? value.trim() : null,
    };
  });

  function update(next: Partial<typeof state>) {
    const s = { ...state, ...next };
    setState(s);
    if (s.mode === "repeat") onChange(s.days.length ? formatWhen({ days: s.days, time: s.time, date: null }) : "");
    else onChange(s.date || !s.kept ? formatWhen({ days: [], time: s.time, date: s.date }) : s.kept);
  }

  const toggleDay = (d: number) => update({ days: state.days.includes(d) ? state.days.filter((x) => x !== d) : [...state.days, d] });

  return (
    <div className="when" role="group" aria-label={`When, for ${label}`}>
      <span className="when-mode">
        <button type="button" aria-pressed={state.mode === "repeat"} disabled={disabled} onClick={() => update({ mode: "repeat" })}>Repeats</button>
        <button type="button" aria-pressed={state.mode === "once"} disabled={disabled} onClick={() => update({ mode: "once" })}>Once</button>
      </span>
      {state.mode === "repeat" ? (
        <span className="when-days">
          {LETTERS.map((l, d) => (
            <button key={d} type="button" aria-pressed={state.days.includes(d)} aria-label={DAY_NAMES[d]} disabled={disabled} onClick={() => toggleDay(d)}>{l}</button>
          ))}
        </span>
      ) : (
        <label className="when-field">
          <span>By</span>
          <input type="date" value={state.date ?? ""} min={today} disabled={disabled} onChange={(e) => update({ date: e.target.value || null, kept: e.target.value ? null : state.kept })} />
        </label>
      )}
      <label className="when-field">
        <span>at</span>
        <input type="time" value={state.time ?? ""} step={300} disabled={disabled} onChange={(e) => update({ time: e.target.value || null })} />
      </label>
      {state.mode === "once" && state.kept && !state.date ? <span className="when-kept">You wrote &ldquo;{state.kept}&rdquo;</span> : null}
      {state.mode === "repeat" && !state.days.length ? <span className="when-kept">Pick the days, or choose Once.</span> : null}
    </div>
  );
}
