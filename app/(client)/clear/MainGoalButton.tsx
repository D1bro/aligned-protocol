"use client";

import { useState } from "react";
import { setMainGoal } from "@/lib/actions/goals";

// Make another active goal the main one. The current main goal stays active.
export function MainGoalButton({ goalId }: { goalId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    setPending(true);
    setError(null);
    const result = await setMainGoal(goalId);
    if (!result.ok) {
      setError(result.message ?? "Couldn’t change your main goal — try again.");
      setPending(false);
    }
  }

  return (
    <div className="main-goal-btn">
      <button type="button" className="au-text-link as-btn" disabled={pending} onClick={choose}>
        {pending ? "Saving…" : "Make this my main goal"}
      </button>
      {error ? <span className="clear-err" role="alert">{error}</span> : null}
    </div>
  );
}
