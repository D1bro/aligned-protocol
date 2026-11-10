"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCheckIn } from "@/lib/actions/next-step";
import { Moves } from "@/components/next-step/Moves";
import type { Move } from "@/lib/actions/next-step";

const CHOICES = [
  { value: "closer", label: "Closer" },
  { value: "same", label: "About the same" },
  { value: "further", label: "Further away" },
] as const;

// The weekly check-in: one question, is it closer? Then the moves (ticked in
// place) and what moved it, in their own words.
export function CheckInForm({ goalId, moves, editHref }: { goalId: string; moves: Move[]; editHref: string | null }) {
  const router = useRouter();
  const [closer, setCloser] = useState<(typeof CHOICES)[number]["value"] | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!closer) return;
    setSaving(true);
    setError(null);
    const res = await saveCheckIn({ goalId, closer, note });
    if (!res.ok) {
      setError(res.message);
      setSaving(false);
      return;
    }
    router.push("/next-step?checked=1");
  }

  return (
    <>
      <div className="ns-choices" role="group" aria-label="Is it closer?">
        {CHOICES.map((c) => (
          <button key={c.value} type="button" aria-pressed={closer === c.value} onClick={() => setCloser(c.value)}>{c.label}</button>
        ))}
      </div>
      {moves.length ? (
        <>
          <p className="au-detail-k ns-moves-k">Your moves</p>
          <Moves moves={moves} />
          {editHref ? <p className="au-small"><a href={editHref} className="au-text-link">Change my moves</a></p> : null}
        </>
      ) : null}
      <label className="au-start-q" htmlFor="ns-moved">What moved it, or what got in the way?</label>
      <p className="au-start-help">Your words, not a list. If you have a coach, they read this before your next session.</p>
      <textarea id="ns-moved" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="ns-form-foot">
        <button type="button" className="btn btn-p" disabled={!closer || saving} onClick={save}>{saving ? "Saving…" : "Save check-in"}</button>
        {error ? <span className="clear-err" role="alert">{error}</span> : null}
      </div>
    </>
  );
}
