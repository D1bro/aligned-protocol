"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { answerReview } from "@/lib/actions/next-step";
import type { ReviewChange } from "@/lib/next-step-review";

// From your session: your Next Step, sharpened (Duane, 10 Nov 2026). The
// version agreed with their coach, part by part, to keep or put aside. They
// own the words: "Keep it" applies it; to change a word, keep it and use
// "Change it" on the card, or put it aside and talk it through next time.
export function ReviewCard({
  reviewId,
  coachFirst,
  sentOn,
  note,
  changes,
  planHref,
}: {
  reviewId: string;
  coachFirst: string;
  sentOn: string;
  note: string | null;
  changes: ReviewChange[];
  planHref: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"keep" | "later" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(keep: boolean) {
    setBusy(keep ? "keep" : "later");
    setError(null);
    const res = await answerReview(reviewId, keep);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  return (
    <section className="au-sum-card ns-review" aria-labelledby={`rv-${reviewId}`}>
      <p className="au-detail-k">From your session · {sentOn}</p>
      <h2 id={`rv-${reviewId}`} className="ns-review-h">Your Next Step, sharpened</h2>
      {note ? <p className="ns-review-note">&ldquo;{note}&rdquo; <span className="au-small">{coachFirst}</span></p> : null}
      {changes.length ? (
        <dl className="ns-review-list">
          {changes.map((c) => (
            <div key={c.label}>
              <dt>{c.label}</dt>
              <dd>
                <span className="ns-review-after">{c.after}</span>
                {c.before ? <span className="ns-review-before">Was: {c.before}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="au-small">Nothing to change: what you wrote already says it.</p>
      )}
      <div className="ns-card-actions">
        <button type="button" className="btn btn-p" disabled={busy !== null} onClick={() => answer(true)}>{busy === "keep" ? "Keeping…" : "Keep it"}</button>
        <button type="button" className="au-text-link as-btn" disabled={busy !== null} onClick={() => answer(false)}>Not now</button>
      </div>
      <p className="au-small">
        They&rsquo;re your words. Keep it, then change anything that doesn&rsquo;t sound like you{planHref ? <> with <b>Change it</b> on your Next Step</> : null}.
      </p>
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </section>
  );
}
