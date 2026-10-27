"use client";

import { useState } from "react";
import { saveMomentumDetails, type MomentumDetails } from "@/lib/actions/membership";

// The Momentum session: what members see on My profile and My membership.
export function MomentumSettings({ initial }: { initial: MomentumDetails | null }) {
  const [when, setWhen] = useState(initial?.momentum_when ?? "");
  const [joinUrl, setJoinUrl] = useState(initial?.momentum_join_url ?? "");
  const [note, setNote] = useState(initial?.momentum_note ?? "");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function save() {
    setPending(true);
    setMsg(null);
    const r = await saveMomentumDetails({ when, joinUrl, note });
    setPending(false);
    setMsg(r.ok ? { text: "Saved. Momentum members see this now." } : { text: r.message ?? "Couldn’t save.", error: true });
  }

  return (
    <div className="cs-form">
      <label className="sw-field">
        <span>When</span>
        <input value={when} onChange={(e) => setWhen(e.target.value)} maxLength={200} placeholder="Tuesdays, 7pm to 8pm (UK time)" />
      </label>
      <label className="sw-field">
        <span>Join link</span>
        <input value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} placeholder="https://zoom.us/j/…" />
      </label>
      <label className="sw-field">
        <span>Note for members (optional)</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Facilitated by Duane. Arrive a few minutes early." />
      </label>
      <div className="cs-actions">
        <button type="button" className="btn btn-p" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</button>
        {msg ? <span className={msg.error ? "clear-err" : "admin-card-sub"} role="status">{msg.text}</span> : null}
      </div>
    </div>
  );
}
