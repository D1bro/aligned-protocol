"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeSessionAction } from "@/lib/actions/step-review";

// Close an older session action: done, or let it go. It leaves the member's
// list and Today; it stays in the session's record.
export function CloseActionButtons({ clientId, commitmentId }: { clientId: string; commitmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close(status: "done" | "dropped") {
    setBusy(true);
    setError(null);
    const res = await closeSessionAction({ clientId, commitmentId, status });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  return (
    <span className="slt-close">
      <button type="button" className="btn btn-g" disabled={busy} onClick={() => close("done")}>Done</button>
      <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => close("dropped")}>Let it go</button>
      {error ? <span className="clear-err" role="alert">{error}</span> : null}
    </span>
  );
}
