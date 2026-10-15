"use client";

import { useEffect, useRef, useState } from "react";
import { saveCoachNote, type CoachNote } from "@/lib/actions/sessions";

type Status =
  | { kind: "saved"; at: string | null }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "conflict"; current: CoachNote; message: string };

// A private coach note. Saves when you press Save or leave the box. The text
// stays in this page until it is saved (it is never put in browser storage),
// and the status only says "Saved" once the database has confirmed it.
export function NoteEditor({
  clientId,
  sessionId,
  initial,
  label = "Private note",
}: {
  clientId: string;
  sessionId: string | null;
  initial: CoachNote | null;
  label?: string;
}) {
  const [note, setNote] = useState<CoachNote | null>(initial);
  const [text, setText] = useState(initial?.body ?? "");
  const [status, setStatus] = useState<Status>({ kind: "saved", at: initial?.updated_at ?? null });
  const saving = useRef(false);

  // Warn before leaving with unsaved text.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status.kind === "dirty" || status.kind === "error" || status.kind === "conflict") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status.kind]);

  async function save(body = text, base: CoachNote | null = note) {
    if (saving.current) return;
    if (base && body === base.body) return setStatus({ kind: "saved", at: base.updated_at });
    if (!base && !body.trim()) return;
    saving.current = true;
    setStatus({ kind: "saving" });
    const r = await saveCoachNote({ noteId: base?.id ?? null, clientId, sessionId, body, expectedVersion: base?.version ?? null });
    saving.current = false;
    if (r.ok) {
      setNote(r.note);
      setStatus({ kind: "saved", at: r.note.updated_at });
    } else if (r.conflict) {
      setStatus({ kind: "conflict", current: r.current, message: r.message });
    } else {
      setStatus({ kind: "error", message: r.message });
    }
  }

  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : null;

  return (
    <div className="note-editor">
      <label className="note-label" htmlFor={`note-${sessionId ?? "general"}`}>
        {label} <em>Only you and the client&rsquo;s assigned coach can see this.</em>
      </label>
      <textarea
        id={`note-${sessionId ?? "general"}`}
        rows={8}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (status.kind !== "conflict") setStatus({ kind: "dirty" });
        }}
        onBlur={() => {
          if (status.kind === "dirty") save();
        }}
      />
      <div className="note-bar" aria-live="polite">
        <button type="button" className="btn btn-g" disabled={status.kind === "saving"} onClick={() => save()}>
          {status.kind === "saving" ? "Saving…" : "Save note"}
        </button>
        <span className={status.kind === "error" || status.kind === "conflict" ? "clear-err" : "note-status"}>
          {status.kind === "saved"
            ? status.at
              ? `Saved ${time(status.at)}`
              : "Nothing saved yet"
            : status.kind === "dirty"
              ? "Unsaved changes"
              : status.kind === "saving"
                ? "Saving…"
                : status.message}
        </span>
        {status.kind === "error" ? (
          <button type="button" className="au-text-link as-btn" onClick={() => save()}>Retry</button>
        ) : null}
      </div>
      {status.kind === "conflict" ? (
        <div className="note-conflict">
          <p>The saved version (changed {time(status.current.updated_at)}):</p>
          <pre>{status.current.body || "(empty)"}</pre>
          <div className="note-bar">
            <button type="button" className="btn btn-g" onClick={() => save(text, status.current)}>Keep my version</button>
            <button
              type="button"
              className="au-text-link as-btn"
              onClick={() => {
                setNote(status.current);
                setText(status.current.body);
                setStatus({ kind: "saved", at: status.current.updated_at });
              }}
            >
              Use the saved version
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
