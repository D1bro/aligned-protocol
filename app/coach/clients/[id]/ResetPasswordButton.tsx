"use client";

import { useState } from "react";
import { sendPasswordReset } from "@/lib/actions/admin";

// Admin: email this person a password reset link.
export function ResetPasswordButton({ clientId }: { clientId: string }) {
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    if (!window.confirm("Email this person a password reset link?")) return;
    setPending(true);
    setNote(null);
    const result = await sendPasswordReset(clientId);
    setPending(false);
    setNote({ ok: result.ok, text: result.message ?? (result.ok ? "Sent." : "Couldn’t send.") });
  }

  return (
    <div className="admin-settings" style={{ borderTop: "1px solid var(--bdr2)", paddingTop: "1rem" }}>
      <button type="button" className="btn btn-g" disabled={pending} onClick={send}>
        {pending ? "Sending…" : "Send password reset email"}
      </button>
      {note ? <p className={note.ok ? "admin-ok" : "clear-err"} role="status">{note.text}</p> : null}
    </div>
  );
}
