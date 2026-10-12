"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendCoachingEnquiry } from "@/lib/actions/learn";

export function EnquiryForm() {
  const router = useRouter();
  const [wantsHelp, setWantsHelp] = useState("");
  const [tried, setTried] = useState("");
  const [availability, setAvailability] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setPending(true);
    setError(null);
    const result = await sendCoachingEnquiry({ wantsHelp, tried, availability });
    setPending(false);
    if (!result.ok) return setError(result.message ?? "Couldn’t send — try again.");
    router.refresh();
  }

  return (
    <section className="learn-reflect coach-enquiry" aria-labelledby="enq-h">
      <h2 id="enq-h">Interested? Tell Duane a little about it.</h2>
      <p className="au-start-help">No commitment. Duane will reply by email to arrange a short call.</p>
      <label htmlFor="enq-help" className="au-start-q">What would you like help with?</label>
      <textarea id="enq-help" rows={3} value={wantsHelp} onChange={(e) => setWantsHelp(e.target.value)} />
      <label htmlFor="enq-tried" className="au-start-q clear-q-sm">What have you tried so far? <span className="au-small">Optional</span></label>
      <textarea id="enq-tried" rows={2} value={tried} onChange={(e) => setTried(e.target.value)} />
      <label htmlFor="enq-when" className="au-start-q clear-q-sm">When suits you for a call? <span className="au-small">Optional</span></label>
      <input id="enq-when" type="text" placeholder="Weekday evenings, Saturday mornings…" value={availability} onChange={(e) => setAvailability(e.target.value)} />
      <div className="learn-actions">
        <button type="button" className="btn btn-p" disabled={!wantsHelp.trim() || pending} onClick={send}>
          {pending ? "Sending…" : "Send my enquiry"}
        </button>
        {error ? <span className="au-small clear-err" aria-live="polite">{error}</span> : null}
      </div>
    </section>
  );
}
