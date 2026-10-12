"use client";

import { useState } from "react";
import Link from "next/link";
import { saveCheckIn, type CheckIn } from "@/lib/actions/checkins";

const DID_IT: { key: CheckIn["did_it"]; label: string }[] = [
  { key: "not_yet", label: "Not yet" },
  { key: "sometimes", label: "Sometimes" },
  { key: "most", label: "Most of the time" },
  { key: "every", label: "Every time" },
];
const NEXT: { key: CheckIn["next_step"]; label: string; help: string }[] = [
  { key: "keep", label: "Keep going", help: "Same action, another month." },
  { key: "adjust", label: "Adjust my action", help: "Make it smaller, or change when." },
  { key: "done", label: "Mark goal done", help: "You’ve got there — set a new one." },
];

export function CheckInForm({
  goalId,
  areaName,
  goalTitle,
  lastScore,
  target,
  ifThen,
}: {
  goalId: string;
  areaName: string;
  goalTitle: string;
  lastScore: number;
  target: number;
  ifThen: string | null;
}) {
  const [didIt, setDidIt] = useState<CheckIn["did_it"] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [helped, setHelped] = useState("");
  const [gotInWay, setGotInWay] = useState("");
  const [next, setNext] = useState<CheckIn["next_step"] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = didIt && score && next;

  async function submit() {
    if (!didIt || !score || !next) return;
    setPending(true);
    setError(null);
    const result = await saveCheckIn({ goalId, didIt, areaScore: score, helped, gotInWay, nextStep: next });
    if (result && !result.ok) {
      setError(result.message);
      setPending(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <Link href="/clear" className="tb-back">← My plan</Link>
        <span className="tb-label">Monthly check-in</span>
      </div>
      <div className="page au-page clear-step">
        <div className="eyebrow"><span className="eydot" /> Monthly check-in · {areaName}</div>
        <h1 className="clear-h">How&rsquo;s it going?</h1>
        <div className="au-sum-card clear-from">
          <p className="au-detail-k">Your action</p>
          <p className="clear-note">{goalTitle}</p>
        </div>

        <p className="au-start-q">How often did you do it this month?</p>
        <div className="au-chips" role="group" aria-label="How often did you do it">
          {DID_IT.map((d) => (
            <button key={d.key} type="button" aria-pressed={didIt === d.key} onClick={() => setDidIt(d.key)}>{d.label}</button>
          ))}
        </div>

        <p className="au-start-q">Where&rsquo;s {areaName} now?</p>
        <p className="au-start-help">Last time: {lastScore}/10. Your target: {target}.</p>
        <div className="au-scores" role="group" aria-label="Score from 1 to 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" data-score={n} aria-pressed={score === n} aria-label={`${n} out of 10`} onClick={() => setScore(n)}>
              {n}
            </button>
          ))}
        </div>

        <label className="au-start-q clear-q-sm" htmlFor="ci-helped">What helped? <span className="au-small">Optional</span></label>
        <textarea id="ci-helped" rows={2} value={helped} onChange={(e) => setHelped(e.target.value)} />
        <label className="au-start-q clear-q-sm" htmlFor="ci-way">What got in the way? <span className="au-small">Optional</span></label>
        {ifThen && (didIt === "not_yet" || didIt === "sometimes") ? (
          <p className="au-start-help">Your plan for this was: {ifThen}</p>
        ) : null}
        <textarea id="ci-way" rows={2} value={gotInWay} onChange={(e) => setGotInWay(e.target.value)} />

        <p className="au-start-q">What next?</p>
        <div className="checkin-next" role="group" aria-label="What next">
          {NEXT.map((n) => (
            <button key={n.key} type="button" aria-pressed={next === n.key} onClick={() => setNext(n.key)}>
              <b>{n.label}</b>
              <span>{n.help}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="foot-nav">
        <span className={`tb-label${error ? " clear-err" : ""}`} aria-live="polite">
          {error ?? (ready ? "Ready to save" : "Answer the three questions to save")}
        </span>
        <button className="btn btn-p" disabled={!ready || pending} onClick={submit}>
          {pending ? "Saving…" : "Save my check-in"}
        </button>
      </div>
    </>
  );
}
