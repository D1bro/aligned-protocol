"use client";

import { useState } from "react";
import { setReminderPreference } from "@/lib/actions/preferences";

// "Email me when a goal check-in is due" — saved immediately; shows the real
// state. Only shown once reminder emails are configured (remindersConfigured).
export function ReminderToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function flip() {
    const next = !on;
    setPending(true);
    setError(false);
    const result = await setReminderPreference(next);
    setPending(false);
    if (result.ok) setOn(next);
    else setError(true);
  }

  return (
    <div className="reminder-toggle">
      <button type="button" role="switch" aria-checked={on} onClick={flip} disabled={pending}>
        <span />
      </button>
      <div>
        <p>Email me when a review is due</p>
        <span>{error ? "Couldn’t save — try again." : on ? "On — one email when each weekly or monthly review is due." : "Off"}</span>
      </div>
    </div>
  );
}
