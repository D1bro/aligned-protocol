"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveMonthReflection } from "@/lib/actions/life";
import { MONTH_COLOURS } from "@/lib/life-months";

// "How would you describe this month?" They choose a colour if one fits, and
// can add a few words. A hard month can still be a meaningful one; rest isn't
// failure. Nothing is chosen for them.
export function MonthReflectionForm({ month, initialColour, initialReflection, saved = false }: { month: string; initialColour: string | null; initialReflection: string | null; saved?: boolean }) {
  const router = useRouter();
  const [colour, setColour] = useState<string | null>(initialColour);
  const [words, setWords] = useState(initialReflection ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = colour !== initialColour || words.trim() !== (initialReflection ?? "").trim();

  async function save() {
    setPending(true);
    setMessage(null);
    const result = await saveMonthReflection({ month, colour, reflection: words });
    setPending(false);
    if (!result.ok) return setMessage({ ok: false, text: result.message });
    setMessage({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <div className="lm-reflect">
      <fieldset>
        <legend className="au-detail-k">If a colour fits, choose one <span className="au-small">Optional</span></legend>
        <div className="lm-colours">
          {MONTH_COLOURS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={colour === c.key ? "lm-colour is-on" : "lm-colour"}
              aria-pressed={colour === c.key}
              onClick={() => setColour(colour === c.key ? null : c.key)}
            >
              <span className={`lm-dot is-past c-${c.key}`} aria-hidden="true" />
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label htmlFor="month-words" className="au-detail-k">A few words about it <span className="au-small">Optional</span></label>
      <textarea id="month-words" rows={3} maxLength={1000} value={words} onChange={(e) => setWords(e.target.value)} placeholder="What this month was like, in your own words" />
      <div className="identity-actions">
        {changed || !saved ? (
          <button type="button" className="btn btn-p" disabled={pending || !changed} onClick={save}>{pending ? "Saving…" : "Save"}</button>
        ) : (
          <span className="lm-saved" role="status">&#10003; Saved. Change anything above to update it.</span>
        )}
        {message && !message.ok ? <span className="clear-err" role="alert">{message.text}</span> : null}
        {saved && !changed ? <Link href="/journey/months" className="btn btn-o">Back to 1,000 Months</Link> : null}
      </div>
      <p className="au-small">Private to you. A challenging month can still be a meaningful one, and rest isn&rsquo;t failure.</p>
    </div>
  );
}
