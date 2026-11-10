"use client";

import { useState } from "react";
import { setMoveDone, type Move } from "@/lib/actions/next-step";

// A Next Step's moves, ticked off in place.
export function Moves({ moves, readOnly = false }: { moves: Move[]; readOnly?: boolean }) {
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(moves.map((m) => [m.id, !!m.done_at])));
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string) {
    const next = !done[id];
    setDone((d) => ({ ...d, [id]: next }));
    setError(null);
    const res = await setMoveDone(id, next);
    if (!res.ok) {
      setDone((d) => ({ ...d, [id]: !next }));
      setError(res.message);
    }
  }

  return (
    <>
      <ul className="ns-move-list">
        {moves.map((m) => (
          <li key={m.id} className={done[m.id] ? "done" : undefined}>
            {readOnly ? (
              <span className="ns-tick" aria-hidden="true" />
            ) : (
              <input type="checkbox" id={`mv-${m.id}`} checked={!!done[m.id]} onChange={() => toggle(m.id)} />
            )}
            <label htmlFor={readOnly ? undefined : `mv-${m.id}`}>
              <span className="ns-move-body">{m.body}</span>
              {m.when_text ? <span className="ns-move-when"> · {m.when_text}</span> : null}
            </label>
          </li>
        ))}
      </ul>
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </>
  );
}
