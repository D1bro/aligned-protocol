"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/actions/sessions";

// Book a session (UK time). "Proposed" until both sides have agreed it.
export function SessionBooking({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState("");
  const [confirmed, setConfirmed] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const r = await createSession({ clientId, date, time, durationMinutes: duration, location, confirmed });
    setPending(false);
    if (!r.ok) return setError(r.message);
    setOpen(false);
    setDate("");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-p" onClick={() => setOpen(true)}>
        Book a session
      </button>
    );
  }
  return (
    <div className="admin-card cs-form">
      <h2>Book a session</h2>
      <div className="cs-grid">
        <label>
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span>Time (UK)</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label>
          <span>Length (minutes)</span>
          <input type="number" min={5} max={600} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </label>
        <label>
          <span>Where</span>
          <input type="text" value={location} placeholder="Zoom link, phone or place" onChange={(e) => setLocation(e.target.value)} />
        </label>
      </div>
      <label className="admin-check">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Already agreed with the
        client (confirmed). Leave unticked to record it as a proposal.
      </label>
      <div className="cs-actions">
        <button type="button" className="btn btn-p" disabled={pending || !date || !time} onClick={submit}>
          {pending ? "Booking…" : "Book it"}
        </button>
        <button type="button" className="au-text-link as-btn" onClick={() => setOpen(false)}>Cancel</button>
        {error ? <span className="clear-err" role="alert">{error}</span> : null}
      </div>
    </div>
  );
}
