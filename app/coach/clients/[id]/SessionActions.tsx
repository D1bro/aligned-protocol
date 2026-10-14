"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelSession, confirmSession, markHeld, markNoShow, rescheduleSession, type SessionState } from "@/lib/actions/sessions";

// The separate things that can happen to a session. Each asks before doing
// anything that can't simply be undone.
export function SessionActions({
  sessionId,
  state,
  localDate,
  localTime,
}: {
  sessionId: string;
  state: SessionState;
  localDate: string;
  localTime: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "reschedule" | "cancel" | "no_show">(null);
  const [date, setDate] = useState(localDate);
  const [time, setTime] = useState(localTime);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    const r = await fn();
    setPending(false);
    if (!r.ok) return setError(r.message ?? "Couldn’t save — try again.");
    setMode(null);
    setText("");
    router.refresh();
  }

  if (state === "held" || state === "cancelled" || state === "no_show") return null;

  if (mode === "reschedule") {
    return (
      <div className="cs-inline">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="New date" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="New time (UK)" />
        <button type="button" className="btn btn-g" disabled={pending} onClick={() => run(() => rescheduleSession(sessionId, date, time))}>
          {pending ? "Saving…" : "Move it"}
        </button>
        <button type="button" className="au-text-link as-btn" onClick={() => setMode(null)}>Keep the time</button>
        {error ? <span className="clear-err" role="alert">{error}</span> : null}
      </div>
    );
  }
  if (mode === "cancel" || mode === "no_show") {
    return (
      <div className="cs-inline">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === "cancel" ? "Reason (optional)" : "What was agreed about it (optional)"}
          aria-label={mode === "cancel" ? "Reason for cancelling" : "No-show decision"}
        />
        <button
          type="button"
          className="btn btn-g"
          disabled={pending}
          onClick={() => run(() => (mode === "cancel" ? cancelSession(sessionId, text) : markNoShow(sessionId, text)))}
        >
          {pending ? "Saving…" : mode === "cancel" ? "Cancel the session" : "Record no-show"}
        </button>
        <button type="button" className="au-text-link as-btn" onClick={() => setMode(null)}>Back</button>
        {error ? <span className="clear-err" role="alert">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="cs-inline">
      {state === "proposed" ? (
        <button type="button" className="btn btn-g" disabled={pending} onClick={() => run(() => confirmSession(sessionId))}>Confirm</button>
      ) : null}
      <button
        type="button"
        className="btn btn-g"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Mark this session as held?")) run(() => markHeld(sessionId));
        }}
      >
        Mark held
      </button>
      <button type="button" className="au-text-link as-btn" onClick={() => setMode("reschedule")}>Reschedule</button>
      <button type="button" className="au-text-link as-btn" onClick={() => setMode("cancel")}>Cancel</button>
      {state === "confirmed" ? (
        <button type="button" className="au-text-link as-btn" onClick={() => setMode("no_show")}>No-show</button>
      ) : null}
      {error ? <span className="clear-err" role="alert">{error}</span> : null}
    </div>
  );
}
