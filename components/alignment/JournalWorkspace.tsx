"use client";

import { useState } from "react";
import { deleteJournalEntry, exportJournal, saveJournalEntry, type JournalEntry } from "@/lib/actions/journal";

// Prompts to start from, if a blank page doesn't help. Today's is chosen by
// the date so it's the same all day.
const PROMPTS = [
  "What’s on my mind right now?",
  "What am I grateful for today?",
  "What did I notice about myself this week?",
  "What do I want more of, and less of?",
  "What’s one thing I handled well?",
  "What’s getting in the way, and what would help?",
  "What would I tell a friend in my position?",
  "What matters most to me this week?",
];

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

// The private journal: write, read back, edit, delete, export. Nothing is
// saved until "Save privately"; there's no autosave or local storage.
export function JournalWorkspace({ initial, today, canWrite }: { initial: JournalEntry[]; today: string; canWrite: boolean }) {
  const dayIndex = Math.floor(new Date(`${today}T12:00:00Z`).getTime() / 86_400_000);
  const todaysPrompt = PROMPTS[dayIndex % PROMPTS.length];
  const [entries, setEntries] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  function reset() {
    setEditing(null);
    setDate(today);
    setPrompt(null);
    setBody("");
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    const r = await saveJournalEntry({ id: editing, entryDate: date, prompt, body });
    setBusy(false);
    if (!r.ok) return setStatus({ text: r.message, error: true });
    const saved = r.entry!;
    setEntries((list) =>
      [saved, ...list.filter((e) => e.id !== saved.id)].sort((a, b) => (b.entry_date + b.created_at).localeCompare(a.entry_date + a.created_at))
    );
    setStatus({ text: editing ? "Updated privately." : "Saved privately." });
    reset();
  }

  async function remove(id: string) {
    setBusy(true);
    const r = await deleteJournalEntry(id);
    setBusy(false);
    setConfirm(null);
    if (!r.ok) return setStatus({ text: r.message, error: true });
    setEntries((list) => list.filter((e) => e.id !== id));
    if (editing === id) reset();
    setStatus({ text: "Entry deleted." });
  }

  async function download() {
    const r = await exportJournal();
    if (!r.ok) return setStatus({ text: r.message, error: true });
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aligned-journal-${today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="alignment-stack">
      {canWrite ? (
        <section className="alignment-card" aria-labelledby="journal-write-h">
          <p className="alignment-kicker">{editing ? "Editing an entry" : "New entry"}</p>
          <h2 id="journal-write-h">{prompt ?? "Write whatever is here today."}</h2>
          <div className="au-chips" role="group" aria-label="Start from a prompt">
            <button type="button" aria-pressed={prompt === todaysPrompt} onClick={() => setPrompt(prompt === todaysPrompt ? null : todaysPrompt)}>Today&rsquo;s prompt</button>
            {PROMPTS.filter((p) => p !== todaysPrompt).slice(0, 4).map((p) => (
              <button key={p} type="button" aria-pressed={prompt === p} onClick={() => setPrompt(prompt === p ? null : p)}>{p}</button>
            ))}
          </div>
          <label className="alignment-label" htmlFor="journal-body">Your entry</label>
          <textarea className="alignment-field journal-body" id="journal-body" rows={9} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="journal-row">
            <label className="alignment-label" htmlFor="journal-date">Date</label>
            <input className="alignment-field journal-date" id="journal-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="alignment-form-footer">
            <p className="alignment-small"><b>Only you can see your journal. Your coach can&rsquo;t.</b></p>
            <div className="alignment-inline">
              {editing ? <button type="button" className="btn btn-g" onClick={reset} disabled={busy}>Cancel</button> : null}
              <button type="button" className="btn btn-p" disabled={busy || !body.trim()} onClick={save}>{busy ? "Saving…" : "Save privately"}</button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="alignment-card" aria-labelledby="journal-list-h">
        <h2 id="journal-list-h">Your entries</h2>
        {entries.length ? (
          <ol className="journal-list">
            {entries.map((e) => (
              <li key={e.id}>
                <p className="journal-when">{dateLabel(e.entry_date)}</p>
                {e.prompt ? <p className="journal-prompt">{e.prompt}</p> : null}
                <p className="journal-text">{e.body}</p>
                <div className="alignment-inline">
                  {canWrite ? (
                    <button
                      type="button"
                      className="alignment-secondary"
                      onClick={() => {
                        setEditing(e.id);
                        setDate(e.entry_date);
                        setPrompt(e.prompt);
                        setBody(e.body);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                  {confirm === e.id ? (
                    <>
                      <span className="alignment-small">Delete this entry? It can&rsquo;t be undone.</span>
                      <button type="button" className="alignment-secondary" onClick={() => setConfirm(null)}>Keep it</button>
                      <button type="button" className="alignment-secondary" disabled={busy} onClick={() => remove(e.id)}>Delete</button>
                    </>
                  ) : (
                    <button type="button" className="alignment-secondary" onClick={() => setConfirm(e.id)}>Delete</button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="alignment-empty">Nothing written yet. There&rsquo;s nothing to catch up on.</p>
        )}
        {entries.length ? <button type="button" className="btn btn-g" onClick={download}>Export my journal</button> : null}
      </section>
      {status ? <p className={`alignment-status${status.error ? " alignment-status-error" : ""}`} role={status.error ? "alert" : "status"}>{status.text}</p> : null}
    </div>
  );
}
