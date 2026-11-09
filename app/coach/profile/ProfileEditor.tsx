"use client";

import { useState } from "react";
import { saveCoachProfile, type LearningArea } from "@/lib/actions/coach-profile";

type Area = { id?: string; text: string; added?: string };

// How the coach works, in their own words, and the learning areas they've
// chosen. A link with ?add=… pre-fills a new learning area (unsaved), so a
// line agreed elsewhere can be kept in one click.
export function ProfileEditor({ initialApproach, initialAreas, suggested }: { initialApproach: string; initialAreas: LearningArea[]; suggested: string }) {
  const startAreas: Area[] = suggested && !initialAreas.some((a) => a.text === suggested) ? [...initialAreas, { text: suggested }] : initialAreas;
  const [approach, setApproach] = useState(initialApproach);
  const [areas, setAreas] = useState<Area[]>(startAreas);
  const [dirty, setDirty] = useState(startAreas.length !== initialAreas.length);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const change = (fn: () => void) => {
    fn();
    setDirty(true);
    setNote(null);
  };

  async function save() {
    setBusy(true);
    const r = await saveCoachProfile({ approach, workingOn: areas.filter((a) => a.text.trim()) });
    setBusy(false);
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setDirty(false);
    setNote({ ok: true, text: "Saved. Your next reflections will use it." });
  }

  return (
    <div className="cpf">
      <section className="admin-card">
        <h2>My approach</h2>
        <p className="admin-card-sub">How you coach, and why: what you deliberately do (stories, directness, warmth, accountability…), and what you&rsquo;d want a reflection to respect.</p>
        <label className="sr-only" htmlFor="cpf-approach">My approach</label>
        <textarea id="cpf-approach" rows={7} maxLength={4000} value={approach} onChange={(e) => change(() => setApproach(e.target.value))} placeholder="In your own words" />
      </section>

      <section className="admin-card">
        <h2>What I&rsquo;m working on</h2>
        <p className="admin-card-sub">One or two learning areas at a time works best. Each reflection finds every moment they applied, what you did, and what followed.</p>
        <ol className="cpf-areas">
          {areas.map((a, i) => (
            <li key={a.id ?? `new-${i}`}>
              <label className="sr-only" htmlFor={`cpf-area-${i}`}>Learning area {i + 1}</label>
              <textarea id={`cpf-area-${i}`} rows={2} maxLength={400} value={a.text} onChange={(e) => change(() => setAreas((list) => list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x))))} />
              <div className="cpf-area-foot">
                <span className="admin-card-sub">{a.added ? `Since ${a.added}` : "Not saved yet"}</span>
                <button type="button" className="au-text-link as-btn" onClick={() => change(() => setAreas((list) => list.filter((_, j) => j !== i)))}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
        {areas.length < 12 ? (
          <button type="button" className="au-text-link as-btn" onClick={() => change(() => setAreas((list) => [...list, { text: "" }]))}>+ Add a learning area</button>
        ) : null}
      </section>

      <div className="cs-actions">
        <button type="button" className="btn btn-p" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save my profile"}</button>
        {note ? <span className={note.ok ? "admin-ok" : "clear-err"} role="status">{note.text}</span> : dirty ? <span className="admin-card-sub">Not saved yet</span> : null}
      </div>
    </div>
  );
}
