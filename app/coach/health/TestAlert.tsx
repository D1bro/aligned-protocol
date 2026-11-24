"use client";

import { useState } from "react";
import { sendTestAlert } from "@/lib/actions/alerts";

type Action = () => Promise<{ ok: boolean; message: string }>;

// A Site health button that sends something to Duane's inbox and says how
// it went: the test alert, or the eight follow-up emails.
export function TestAlert({ action = sendTestAlert, label = "Send a test alert", busyLabel = "Sending…" }: { action?: Action; label?: string; busyLabel?: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function send() {
    setPending(true);
    setResult(null);
    setResult(await action().catch(() => ({ ok: false, message: "Couldn’t reach the site. Try again." })));
    setPending(false);
  }

  return (
    <div className="admin-test-alert">
      <button type="button" className="btn btn-o" disabled={pending} onClick={send}>
        {pending ? busyLabel : label}
      </button>
      {result ? (
        <span className={result.ok ? "au-small" : "au-small clear-err"} aria-live="polite">{result.message}</span>
      ) : null}
    </div>
  );
}
