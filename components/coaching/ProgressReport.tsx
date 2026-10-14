"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reportProgress } from "@/lib/actions/member-coaching";

const OPTIONS = [
  ["done", "Done"],
  ["partly", "Partly"],
  ["tried", "Tried it"],
  ["not_yet", "Not yet"],
] as const;

// "How did it go?" for one agreed step. Shared with the coach; it doesn't
// mark the member's whole goal as done.
export function ProgressReport({ commitmentId }: { commitmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<(typeof OPTIONS)[number][0] | null>(null);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="au-text-link as-btn" onClick={() => setOpen(true)}>
        Update how it&rsquo;s going
      </button>
    );
  }
  async function save() {
    if (!progress) return setError("Choose how it went.");
    setPending(true);
    setError(null);
    const r = await reportProgress({ commitmentId, progress, note, supportRequested: support });
    setPending(false);
    if (!r.ok) return setError(r.message ?? "Couldn’t save — try again.");
    setOpen(false);
    setProgress(null);
    setNote("");
    setSupport(false);
    router.refresh();
  }
  return (
    <div className="mc-report">
      <div className="au-chips" role="group" aria-label="How it went">
        {OPTIONS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={progress === k} onClick={() => setProgress(k)}>{label}</button>
        ))}
      </div>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? (optional)" aria-label="What happened" />
      <label className="admin-check">
        <input type="checkbox" checked={support} onChange={(e) => setSupport(e.target.checked)} /> I&rsquo;d like some support with this
      </label>
      <div className="cs-actions">
        <button type="button" className="btn btn-g" disabled={pending} onClick={save}>{pending ? "Saving…" : "Share update"}</button>
        <button type="button" className="au-text-link as-btn" onClick={() => setOpen(false)}>Cancel</button>
        {error ? <span className="clear-err" role="alert">{error}</span> : null}
      </div>
      <p className="admin-card-sub">Your coach sees this. It doesn&rsquo;t mark your whole goal as done.</p>
    </div>
  );
}
