"use client";

import { useState } from "react";
import { setEnquiryStatus, type CoachEnquiry } from "@/lib/actions/coach";

const OPTIONS: { key: CoachEnquiry["status"]; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "booked", label: "Booked" },
  { key: "closed", label: "Closed" },
];

export function EnquiryStatus({ id, initial }: { id: string; initial: CoachEnquiry["status"] }) {
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState(false);

  async function change(next: CoachEnquiry["status"]) {
    const prev = status;
    setStatus(next);
    setError(false);
    const result = await setEnquiryStatus(id, next);
    if (!result.ok) {
      setStatus(prev);
      setError(true);
    }
  }

  return (
    <div className="enq-status">
      <select aria-label="Enquiry status" value={status} onChange={(e) => change(e.target.value as CoachEnquiry["status"])}>
        {OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      {error ? <span className="clear-err">Couldn&rsquo;t save</span> : null}
    </div>
  );
}
