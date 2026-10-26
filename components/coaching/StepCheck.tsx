"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addProgressNote, reportProgress } from "@/lib/actions/member-coaching";

const OPTIONS = [
  ["not_yet", "Not yet"],
  ["partly", "Partly"],
  ["tried", "Tried it"],
  ["done", "Done"],
] as const;
type Progress = (typeof OPTIONS)[number][0];

// One tap to say how an agreed step is going, shared with the coach straight
// away. A note, or a request for support, can follow. Marking a step done
// doesn't mark the member's whole goal as done.
export function StepCheck({ commitmentId, current }: { commitmentId: string; current: string | null }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(current);
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const [noted, setNoted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(progress: Progress) {
    if (pending || progress === picked) return;
    const before = picked;
    setPicked(progress);
    setPending(true);
    setError(null);
    const r = await reportProgress({ commitmentId, progress, note: "", supportRequested: false });
    setPending(false);
    if (!r.ok || !r.id) {
      setPicked(before);
      return setError(r.message ?? "Couldn’t save — try again.");
    }
    setUpdateId(r.id);
    setNoted(false);
    router.refresh();
  }

  async function saveNote() {
    if (!updateId) return;
    setPending(true);
    setError(null);
    const r = await addProgressNote({ updateId, note, supportRequested: support });
    setPending(false);
    if (!r.ok) return setError(r.message ?? "Couldn’t save — try again.");
    setNoting(false);
    setNoted(true);
    setNote("");
    setSupport(false);
    router.refresh();
  }

  return (
    <div className="mc-check-ctl">
      <div className="au-chips" role="group" aria-label="How it's going">
        {OPTIONS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={picked === k} onClick={() => pick(k)}>{label}</button>
        ))}
      </div>
      {updateId && !noting ? (
        <p className="admin-card-sub">
          {noted ? "Note shared with your coach." : "Shared with your coach."}{" "}
          {noted ? null : <button type="button" className="au-text-link as-btn" onClick={() => setNoting(true)}>Add a note</button>}
        </p>
      ) : null}
      {noting ? (
        <div className="mc-report">
          <textarea rows={2} value={note} onChange={(e) => { setNote(e.target.value); setError(null); }} placeholder="What happened? (optional)" aria-label="What happened" />
          <label className="admin-check">
            <input type="checkbox" checked={support} onChange={(e) => { setSupport(e.target.checked); setError(null); }} /> I&rsquo;d like some support with this
          </label>
          <div className="cs-actions">
            <button type="button" className="btn btn-g" disabled={pending} onClick={saveNote}>{pending ? "Saving…" : "Share note"}</button>
            <button type="button" className="au-text-link as-btn" onClick={() => setNoting(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </div>
  );
}
