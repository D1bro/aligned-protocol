"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeGuest, removeIdleGuests } from "@/lib/actions/guests";

const plural = (n: number) => `${n} guest${n === 1 ? "" : "s"}`;

// Bulk clean-up: unfinished guests who've done nothing for a while. The
// counts come from the page; the server decides again when it runs.
export function GuestCleanup({ counts }: { counts: { days: number; n: number }[] }) {
  const router = useRouter();
  const [days, setDays] = useState(counts[1]?.days ?? counts[0]?.days ?? 30);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const n = counts.find((c) => c.days === days)?.n ?? 0;

  async function run() {
    if (!n) return;
    if (!window.confirm(`Permanently remove ${plural(n)} who never finished the audit and haven't done anything for ${days} days or more? Their answers are deleted too. This can't be undone.`)) return;
    setPending(true);
    setNote(null);
    const result = await removeIdleGuests(days);
    setPending(false);
    setNote({ ok: result.ok, text: result.message });
    router.refresh();
  }

  return (
    <div className="gm-cleanup">
      <label className="admin-check">
        Unfinished and idle for
        <select value={days} disabled={pending} onChange={(e) => { setDays(Number(e.target.value)); setNote(null); }}>
          {counts.map((c) => <option key={c.days} value={c.days}>{c.days}+ days ({c.n})</option>)}
        </select>
      </label>
      <button type="button" className="btn btn-danger bl-btn" disabled={pending || !n} onClick={run}>
        {pending ? "Removing…" : n ? `Remove ${plural(n)}` : "Nobody to remove"}
      </button>
      {note ? <p className={note.ok ? "admin-ok" : "clear-err"} role="status">{note.text}</p> : null}
    </div>
  );
}

// Remove one guest. On their own page, goes back to the guest list after.
export function RemoveGuestButton({ id, after, label = "Remove" }: { id: string; after?: string; label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!window.confirm("Permanently remove this guest and their audit answers? This can't be undone.")) return;
    setPending(true);
    setError(null);
    const result = await removeGuest(id);
    if (!result.ok) {
      setPending(false);
      return setError(result.message);
    }
    if (after) router.push(after);
    else router.refresh();
  }

  return (
    <span className="gm-remove">
      <button type="button" className="btn btn-danger bl-btn" disabled={pending} onClick={run}>
        {pending ? "Removing…" : label}
      </button>
      {error ? <em className="clear-err" role="status">{error}</em> : null}
    </span>
  );
}
