"use client";

import { useState } from "react";
import { setGoalStatus } from "@/lib/actions/clear";

// Close the whole goal: done, or let go. Both ask once to confirm, because
// doing the action once isn't the same as finishing the goal.
export function GoalActions({ goalId }: { goalId: string }) {
  const [confirming, setConfirming] = useState<"completed" | "abandoned" | null>(null);
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
      {confirming === "completed" ? (
        <>
          <span>Is the whole goal done — not just this week&rsquo;s action?</span>
          <button type="button" className="btn btn-g" disabled={pending} onClick={() => close("completed")}>
            {pending ? "Saving…" : "Yes, the goal is done"}
          </button>
          <button type="button" className="au-text-link as-btn" disabled={pending} onClick={() => setConfirming(null)}>Not yet</button>
        </>
      ) : confirming === "abandoned" ? (
        <>
          <span>Let this goal go? It stays in your history.</span>
          <button type="button" className="btn btn-g" disabled={pending} onClick={() => close("abandoned")}>
            {pending ? "Saving…" : "Yes, let it go"}
          </button>
          <button type="button" className="au-text-link as-btn" disabled={pending} onClick={() => setConfirming(null)}>Keep it</button>
        </>
      ) : (
        <>
          <button type="button" className="au-text-link as-btn" onClick={() => setConfirming("completed")}>The whole goal is done</button>
          <button type="button" className="au-text-link as-btn" onClick={() => setConfirming("abandoned")}>Let it go</button>
        </>
      )}
      {error ? <span className="clear-err" role="alert">{error}</span> : null}
    </div>
  );
}
