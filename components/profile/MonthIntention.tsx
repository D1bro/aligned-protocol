"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveMonthIntention } from "@/lib/actions/planning";

// "How do you want to live this month?" in their own words. The suggestions
// come from their goals and only fill the box: they edit or replace them.
export function MonthIntention({ initial, suggestions, goalId }: { initial: string | null; suggestions: string[]; goalId: string | null }) {
  const router = useRouter();
  const [text, setText] = useState(initial ?? "");
  const [editing, setEditing] = useState(!initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const result = await saveMonthIntention({ intention: text, goalId });
    setPending(false);
    if (!result.ok) return setError(result.message);
    setEditing(false);
    router.refresh();
  }

  if (!editing && initial) {
    return (
      <div className="ms-intention">
        <p className="profile-card-k">Month intention</p>
        <p className="ms-intention-text">{initial}</p>
        <button type="button" className="au-text-link as-btn" onClick={() => setEditing(true)}>Edit</button>
      </div>
    );
  }

  return (
    <div className="ms-intention">
      <label htmlFor="month-intention" className="profile-card-k">How do you want to live this month?</label>
      <input id="month-intention" type="text" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="In your own words" />
      {suggestions.length ? (
        <ul className="ms-chips" aria-label="Suggestions to start from">
          {suggestions.map((s) => (
            <li key={s}><button type="button" onClick={() => setText(s)}>{s}</button></li>
          ))}
        </ul>
      ) : null}
      <div className="identity-actions">
        <button type="button" className="btn btn-g" disabled={pending || !text.trim()} onClick={save}>{pending ? "Saving…" : "Save"}</button>
        {initial ? (
          <button type="button" className="au-text-link as-btn" disabled={pending} onClick={() => { setText(initial); setEditing(false); setError(null); }}>Cancel</button>
        ) : null}
        {error ? <span className="clear-err" role="alert">{error}</span> : null}
      </div>
    </div>
  );
}
