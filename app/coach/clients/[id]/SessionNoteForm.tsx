"use client";

import { useState, useTransition } from "react";
import { addSessionNote } from "@/lib/actions/coach";
import { Notice } from "@/components/ui/Notice";

export function SessionNoteForm({ clientId }: { clientId: string }) {
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [focus, setFocus] = useState("");
  const [note, setNote] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await addSessionNote({ clientId, sessionDate, focus, note, nextActions, clientMood: null });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setFocus("");
      setNote("");
      setNextActions("");
    });
  }

  return (
    <div className="card" style={{ marginBottom: "1.25rem" }}>
      <label className="lbl" htmlFor="session-date">Date</label>
      <input id="session-date" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />

      <label className="lbl" htmlFor="session-focus">Focus (optional)</label>
      <input
        id="session-focus"
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        placeholder="What did this session focus on?"
      />

      <label className="lbl" htmlFor="session-note">Note</label>
      <textarea
        id="session-note"
        rows={4}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened in this session?"
      />

      <label className="lbl" htmlFor="session-next">Next actions (optional)</label>
      <textarea
        id="session-next"
        rows={2}
        value={nextActions}
        onChange={(e) => setNextActions(e.target.value)}
        placeholder="What's the client doing before next time?"
      />

      <Notice type="err">{error}</Notice>
      <button
        className="btn btn-p"
        disabled={pending || !note.trim()}
        onClick={submit}
        style={{ marginTop: ".5rem" }}
      >
        {pending ? "Saving…" : "Add session note"}
      </button>
    </div>
  );
}
