"use client";

import { useState } from "react";
import { setGoalStatus } from "@/lib/actions/clear";

// Close a goal: done, or let go. Letting go asks once to confirm.
export function GoalActions({ goalId }: { goalId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close(status: "completed" | "abandoned") {
    setPending(true);
    setError(null);
    const result = await setGoalStatus(goalId, status);
    if (!result.ok) {
      setError(result.message);
      setPending(false);
    }
  }

  return (
    <div className="goal-actions">
      {confirming ? (
        <>
          <span>Let this goal go?</span>
          <button type="button" className="btn btn-g" disabled={pending} onClick={() => close("abandoned")}>Yes, let it go</button>
          <button type="button" className="au-text-link as-btn" disabled={pending} onClick={() => setConfirming(false)}>Keep it</button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-o" disabled={pending} onClick={() => close("completed")}>
            {pending ? "Saving…" : "Mark as done"}
          </button>
          <button type="button" className="au-text-link as-btn" disabled={pending} onClick={() => setConfirming(true)}>Let it go</button>
        </>
      )}
      {error ? <span className="clear-err" role="alert">{error}</span> : null}
    </div>
  );
}
