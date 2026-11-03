"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dismissSuggestions } from "@/lib/actions/planning";
import type { AuditSuggestion } from "@/lib/planning";

// After a new audit: what's changed since this goal was set (lib/planning.ts).
// Each suggestion opens the plan for them to accept or edit; dismissing hides
// them for this audit. Their goal is never changed for them.
export function WhatsChanged({ auditId, auditDate, suggestions }: { auditId: string; auditDate: string; suggestions: AuditSuggestion[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function dismiss() {
    setBusy(true);
    setError(false);
    const result = await dismissSuggestions(auditId);
    setBusy(false);
    if (!result.ok) return setError(true);
    router.refresh();
  }

  return (
    <section className="pl-card pl-changed" aria-labelledby="pl-changed-h">
      <h2 id="pl-changed-h" className="pl-k">What&rsquo;s changed: your audit on {auditDate}</h2>
      <ul>
        {suggestions.map((s) => (
          <li key={s.key}>
            <p>{s.text}</p>
            {s.href ? (
              <Link href={s.href} className="btn btn-g">{s.label} →</Link>
            ) : (
              <button type="button" className="btn btn-g" disabled={busy} onClick={dismiss}>{s.label}</button>
            )}
          </li>
        ))}
      </ul>
      <p className="pl-changed-foot">
        Suggestions only: your goal, actions and history stay as they are. You can also{" "}
        <Link href="/plan?latest=1">make a plan from your latest audit</Link>.{" "}
        <button type="button" className="au-text-link as-btn" disabled={busy} onClick={dismiss}>Dismiss</button>
        {error ? <span className="clear-err" role="alert"> Couldn&rsquo;t save just now — try again.</span> : null}
      </p>
    </section>
  );
}
