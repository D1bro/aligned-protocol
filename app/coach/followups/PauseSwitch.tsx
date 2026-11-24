"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setFollowupsPaused } from "@/lib/actions/followups";

// Pause every follow-up email. Paused days don't count towards anyone's day
// 1, 3, 7 or 10, so on resume everyone carries on where they were.
export function PauseSwitch({ paused, since, disabled }: { paused: boolean; since: string | null; disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function toggle() {
    setPending(true);
    setMsg(null);
    const r = await setFollowupsPaused(!paused).catch(() => ({ ok: false as const, message: "Couldn’t reach the site. Try again." }));
    setPending(false);
    setMsg({ ok: r.ok, text: r.message ?? "" });
    if (r.ok) router.refresh();
  }

  return (
    <section className={`admin-card fu-pause${paused ? " is-paused" : ""}`} aria-labelledby="fu-pause-h">
      <h2 id="fu-pause-h">{paused ? "Paused" : "Sending"}</h2>
      <p className="admin-card-sub">
        {paused
          ? `Nothing has gone since ${since ?? "you paused"}. Paused days don’t count, so when you resume everyone carries on where they were.`
          : "Follow-ups go at 9:21am each morning. Pausing stops them all without anyone losing their place."}
      </p>
      <div className="fu-actions">
        <button type="button" className={paused ? "btn btn-g" : "btn btn-o"} disabled={pending || disabled} onClick={toggle}>
          {pending ? "Saving…" : paused ? "Resume sending" : "Pause all follow-ups"}
        </button>
        {msg ? <span className={msg.ok ? "admin-ok" : "clear-err"} role="status">{msg.text}</span> : null}
      </div>
    </section>
  );
}
