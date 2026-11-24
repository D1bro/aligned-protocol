"use client";

import { useState } from "react";
import { sendTestAlert } from "@/lib/actions/alerts";

export function TestAlert() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function send() {
    setPending(true);
    setResult(null);
    setResult(await sendTestAlert().catch(() => ({ ok: false, message: "Couldn’t reach the site. Try again." })));
    setPending(false);
  }

  return (
    <div className="admin-test-alert">
      <button type="button" className="btn btn-o" disabled={pending} onClick={send}>
        {pending ? "Sending…" : "Send a test alert"}
      </button>
      {result ? (
        <span className={result.ok ? "au-small" : "au-small clear-err"} aria-live="polite">{result.message}</span>
      ) : null}
    </div>
  );
}
