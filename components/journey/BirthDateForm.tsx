"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBirthDate } from "@/lib/actions/life";

// The optional date of birth. Only its month and year are used, for 1,000
// Months; it's private (not even a coach can see it) and can be cleared.
export function BirthDateForm({ initial, compact = false }: { initial: string | null; compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(next: string) {
    setPending(true);
    setMessage(null);
    const result = await saveBirthDate(next);
    setPending(false);
    if (!result.ok) return setMessage({ ok: false, text: result.message });
    setValue(next);
    setMessage({ ok: true, text: next ? "Saved." : "Removed." });
    router.refresh();
  }

  return (
    <div className={compact ? "lm-birth is-compact" : "lm-birth"}>
      <label htmlFor="birth-date" className="au-detail-k">Date of birth <span className="au-small">Optional</span></label>
      <div className="lm-birth-row">
        <input id="birth-date" type="date" value={value} max={new Date().toISOString().slice(0, 10)} min="1900-01-01" onChange={(e) => setValue(e.target.value)} />
        <button type="button" className="btn btn-g" disabled={pending || value === (initial ?? "")} onClick={() => save(value)}>{pending ? "Saving…" : "Save"}</button>
        {initial ? <button type="button" className="au-text-link as-btn" disabled={pending} onClick={() => save("")}>Remove</button> : null}
      </div>
      <p className="au-small">Only the month and year are used, to draw 1,000 Months. It&rsquo;s private to you: your coach can&rsquo;t see it.</p>
      {message ? <p className={message.ok ? "lm-saved" : "clear-err"} role={message.ok ? "status" : "alert"}>{message.text}</p> : null}
    </div>
  );
}
