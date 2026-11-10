"use client";

import { useState } from "react";
import { shareWithCoach } from "@/lib/actions/next-step";

// "Bring your coach in on it": emails their coach that this Next Step is set.
export function ShareWithCoach({ goalId, coachFirst, sharedOn }: { goalId: string; coachFirst: string; sharedOn: string | null }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send() {
    setState("sending");
    const res = await shareWithCoach(goalId);
    if (res.ok) return setState("sent");
    setMessage(res.message);
    setState("error");
  }

  return (
    <div className="au-sum-card ns-coach-card">
      <p className="ns-coach-h">Bring {coachFirst} in on it</p>
      <p>Send your Next Step to your coach. They&rsquo;ll see it before your next session, and you&rsquo;ll start that session from here.</p>
      {state === "sent" ? (
        <p className="ns-flash" role="status">Sent to {coachFirst}.</p>
      ) : (
        <div className="ns-coach-act">
          <button type="button" className="btn btn-p" onClick={send} disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : sharedOn ? `Send to ${coachFirst} again` : `Share with ${coachFirst}`}
          </button>
          {sharedOn && state === "idle" ? <span className="au-small">Shared on {sharedOn}</span> : null}
        </div>
      )}
      {state === "error" ? <p className="clear-err" role="alert">{message}</p> : null}
    </div>
  );
}
