"use client";

import { useState } from "react";
import { saveClientContext } from "@/lib/actions/coach-profile";

// What the coach knows about this client (their history together, what they
// respond to, where they are now). Private to the coach; read by every
// reflection before it judges a session.
export function ClientContextEditor({ clientId, firstName, initial }: { clientId: string; firstName: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    const r = await saveClientContext(clientId, text);
    setBusy(false);
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setSaved(text);
    setNote({ ok: true, text: "Saved. The next reflection will use it." });
  }

  return (
    <section className="admin-card cc-card" aria-labelledby="cc-h">
      <h2 id="cc-h">What you know about {firstName}</h2>
      <p className="admin-card-sub">Only you see this. Their history with you, what they respond to, where they are now. Reflections read it before judging a session.</p>
      <label className="sr-only" htmlFor="cc-notes">What you know about {firstName}</label>
      <textarea id="cc-notes" rows={6} maxLength={4000} value={text} onChange={(e) => { setText(e.target.value); setNote(null); }} placeholder={`For example: early on, ${firstName} didn't feel safe; responds to support and encouragement`} />
      <div className="cs-actions">
        <button type="button" className="btn btn-g" disabled={busy || text === saved} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        {note ? <span className={note.ok ? "admin-ok" : "clear-err"} role="status">{note.text}</span> : null}
      </div>
    </section>
  );
}
