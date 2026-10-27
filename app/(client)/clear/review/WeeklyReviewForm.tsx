"use client";

import { useState } from "react";
import Link from "next/link";
import { saveWeeklyReview, type WeeklyReview } from "@/lib/actions/checkins";

const HAPPENED: { key: WeeklyReview["did_it"]; label: string }[] = [
  { key: "done", label: "Done" },
  { key: "partly", label: "Partly" },
  { key: "missed", label: "Not this week" },
];
const NEXT: { key: WeeklyReview["next_step"]; label: string }[] = [
  { key: "keep", label: "Keep it" },
  { key: "smaller", label: "Make it smaller" },
  { key: "change", label: "Change it" },
];

// The weekly review: about a minute. What I intended, what happened, what
// helped or got in the way, then what I'm committing to next. A missed week
// leads to making it smaller, not to trying harder.
export function WeeklyReviewForm({
  goalId,
  areaName,
  week,
  intended,
  smaller,
}: {
  goalId: string;
  areaName: string;
  week: number;
  intended: string;
  // The commitment rewritten with their fallback, for "Make it smaller".
  smaller: string;
}) {
  const [happened, setHappened] = useState<WeeklyReview["did_it"] | null>(null);
  const [helped, setHelped] = useState("");
  const [next, setNext] = useState<WeeklyReview["next_step"]>("keep");
  const [commitment, setCommitment] = useState(intended);
  const [edited, setEdited] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(step: WeeklyReview["next_step"]) {
    setNext(step);
    if (!edited) setCommitment(step === "keep" ? intended : step === "smaller" ? smaller || intended : "");
  }

  function pick(h: WeeklyReview["did_it"]) {
    setHappened(h);
    if (h === "missed" && next === "keep") choose("smaller");
  }

  async function submit() {
    if (!happened) return;
    setPending(true);
    setError(null);
    const result = await saveWeeklyReview({ goalId, didIt: happened, helped, nextStep: next, nextCommitment: commitment });
    if (result && !result.ok) {
      setError(result.message);
      setPending(false);
    }
  }

  const ready = !!happened && !!commitment.trim();

  return (
    <>
      <div className="topbar">
        <Link href="/" className="tb-back">← My profile</Link>
        <span className="tb-label">Weekly review · week {week}</span>
      </div>
      <div className="page au-page clear-step">
        <div className="eyebrow"><span className="eydot" /> Weekly review · {areaName}</div>
        <h1 className="clear-h">How did this week go?</h1>
        <div className="au-sum-card clear-from">
          <p className="au-detail-k">What I intended to do</p>
          <p className="clear-note">{intended}</p>
        </div>

        <p className="au-start-q">What happened?</p>
        <div className="au-chips" role="group" aria-label="What happened">
          {HAPPENED.map((h) => (
            <button key={h.key} type="button" aria-pressed={happened === h.key} onClick={() => pick(h.key)}>{h.label}</button>
          ))}
        </div>
        {happened === "missed" ? (
          <p className="au-start-help">Missed weeks happen. Making it smaller, or moving the day, usually helps more than trying harder.</p>
        ) : null}

        <label className="au-start-q clear-q-sm" htmlFor="wr-helped">What helped, or got in the way? <span className="au-small">Optional</span></label>
        <input id="wr-helped" type="text" value={helped} onChange={(e) => setHelped(e.target.value)} placeholder="One line is plenty" />

        <p className="au-start-q">What will I keep, simplify or change?</p>
        <div className="au-chips" role="group" aria-label="Keep, simplify or change">
          {NEXT.map((n) => (
            <button key={n.key} type="button" aria-pressed={next === n.key} onClick={() => choose(n.key)}>{n.label}</button>
          ))}
        </div>

        <label className="au-start-q" htmlFor="wr-next">What am I committing to next?</label>
        {next === "change" ? (
          <p className="au-start-help">
            Write next week&rsquo;s commitment here. To change your plan&rsquo;s action for good,{" "}
            <Link href="/clear?edit=4">adjust it in My plan</Link>.
          </p>
        ) : null}
        <textarea
          id="wr-next"
          rows={3}
          value={commitment}
          onChange={(e) => {
            setEdited(true);
            setCommitment(e.target.value);
          }}
        />
      </div>
      <div className="foot-nav">
        <span className={`tb-label${error ? " clear-err" : ""}`} aria-live="polite">
          {error ?? (ready ? "Ready to save" : "Say what happened, and what’s next")}
        </span>
        <button className="btn btn-p" disabled={!ready || pending} onClick={submit}>
          {pending ? "Saving…" : "Save my review"}
        </button>
      </div>
    </>
  );
}
