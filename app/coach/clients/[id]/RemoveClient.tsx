"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeClient } from "@/lib/actions/remove-client";
import { emailMatches } from "@/lib/client-removal";

// Admin: remove a client for good. Opens a panel that spells out what goes,
// and only allows it once their email has been typed.
export function RemoveClient({ clientId, email, name }: { clientId: string; email: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = emailMatches(typed, email);

  async function run() {
    if (!matches) return;
    setPending(true);
    setError(null);
    const result = await removeClient(clientId, typed);
    if (!result.ok) {
      setPending(false);
      return setError(result.message);
    }
    router.push("/coach/clients");
  }

  if (!open) {
    return (
      <div className="rc-wrap">
        <button type="button" className="btn btn-danger bl-btn" onClick={() => setOpen(true)}>Remove this client…</button>
      </div>
    );
  }

  return (
    <div className="rc-wrap rc-panel" role="group" aria-label="Remove this client">
      <p className="rc-warn">
        <b>Remove {name} permanently?</b> Their sign-in, audits, plans, goals, check-ins, lessons, coaching sessions,
        summaries and notes are all deleted. This can&rsquo;t be undone, and they&rsquo;d need a new invite to come back.
      </p>
      <label className="rc-label">
        <span>Type their email to confirm: <b>{email}</b></span>
        <input
          type="email"
          value={typed}
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          onChange={(e) => { setTyped(e.target.value); setError(null); }}
          aria-label="Their email, to confirm"
        />
      </label>
      <div className="rc-actions">
        <button type="button" className="btn btn-danger bl-btn" disabled={!matches || pending} onClick={run}>
          {pending ? "Removing…" : "Remove permanently"}
        </button>
        <button type="button" className="btn btn-g bl-btn" disabled={pending} onClick={() => { setOpen(false); setTyped(""); setError(null); }}>
          Cancel
        </button>
      </div>
      {error ? <p className="clear-err" role="status">{error}</p> : null}
    </div>
  );
}
