"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { previewMessage, sendMessage, type MessageKind } from "@/lib/actions/messages";

type Last = { status: "queued" | "sent" | "failed"; sent_at: string | null; created_at: string; error: string | null } | null;

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// "Email Sam about this": shows exactly what will be sent, takes an optional
// note, and sends once. Separate from sharing or issuing in the app. For a
// shared summary, the coach can tick to include its client-facing wording.
export function EmailButton({ kind, refId, label, last }: { kind: MessageKind; refId: string; label: string; last: Last }) {
  const router = useRouter();
  const [preview, setPreview] = useState<null | { to: string; subject: string; text: string; ready: boolean; reason?: string }>(null);
  const [note, setNote] = useState("");
  const [includeSummary, setIncludeSummary] = useState(false);
  const [pending, setPending] = useState<null | "preview" | "send">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const again = last?.status === "sent";

  async function open() {
    setPending("preview");
    setMsg(null);
    const r = await previewMessage(kind, refId, note, { includeSummary });
    setPending(null);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setPreview({ to: r.to, subject: r.subject, text: r.text, ready: r.email.ready, reason: r.email.reason });
  }

  async function refreshPreview(nextNote: string, withSummary = includeSummary) {
    const r = await previewMessage(kind, refId, nextNote, { includeSummary: withSummary });
    if (r.ok) setPreview((p) => (p ? { ...p, subject: r.subject, text: r.text } : p));
  }

  async function send() {
    setPending("send");
    setMsg(null);
    const r = await sendMessage({ kind, refId, note, again, includeSummary });
    setPending(null);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) {
      setPreview(null);
      setNote("");
      router.refresh();
    }
  }

  const status =
    last?.status === "sent" ? `Emailed ${when(last.sent_at ?? last.created_at)}` : last?.status === "failed" ? "Email failed" : last?.status === "queued" ? "Email sending…" : null;

  if (!preview) {
    return (
      <span className="bl-act">
        {status ? <span className={`cs-state ${last?.status === "failed" ? "bl-overdue" : last?.status === "sent" ? "bl-paid" : ""}`}>{status}</span> : null}
        <button type="button" className="au-text-link as-btn" disabled={pending !== null} onClick={open}>
          {pending === "preview" ? "Preparing…" : last?.status === "failed" ? "Try again" : again ? "Send again" : label}
        </button>
        {msg ? <span className={msg.ok ? "bl-ok" : "clear-err"} role={msg.ok ? "status" : "alert"}>{msg.text}</span> : null}
      </span>
    );
  }
  return (
    <div className="bl-form em-preview">
      <p className="cs-meta">
        To <b>{preview.to}</b> · Subject: <b>{preview.subject}</b>
      </p>
      {kind === "summary_shared" ? (
        <label className="admin-check">
          <input
            type="checkbox"
            checked={includeSummary}
            onChange={(e) => {
              setIncludeSummary(e.target.checked);
              refreshPreview(note, e.target.checked);
            }}
          />{" "}
          Include the summary in the email (only what they see in the app; never your private notes)
        </label>
      ) : null}
      <pre className="em-body">{preview.text}</pre>
      <label className="sw-field">
        <span>Add a personal note (optional)</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={(e) => refreshPreview(e.target.value)} maxLength={1000} />
      </label>
      {!preview.ready ? <p className="bl-warn">{preview.reason} Nothing will be sent.</p> : preview.reason ? <p className="bl-warn">{preview.reason}</p> : null}
      {again ? <p className="bl-warn">This was already emailed{last?.sent_at ? ` on ${when(last.sent_at)}` : ""}. Sending again sends a second copy.</p> : null}
      <div className="cs-actions">
        <button type="button" className="btn btn-p" disabled={pending !== null || !preview.ready} onClick={send}>
          {pending === "send" ? "Sending…" : again ? "Send a second copy" : "Send email"}
        </button>
        <button type="button" className="au-text-link as-btn" onClick={() => setPreview(null)}>Cancel</button>
        {msg && !msg.ok ? <span className="clear-err" role="alert">{msg.text}</span> : null}
      </div>
    </div>
  );
}
