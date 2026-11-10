"use client";

import { useState } from "react";
import Link from "next/link";
import { markTaken } from "@/lib/actions/next-step";
import { openNextStep } from "@/lib/actions/next-step";
import { stepsBetween } from "@/lib/next-step";

// "You took your Next Step": score the area again, say what changed, then
// choose what's next.
export function TakenForm({
  goalId,
  area,
  areaId,
  start,
  aim,
}: {
  goalId: string;
  area: string;
  areaId: string | null;
  start: number | null;
  aim: number | null;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [changed, setChanged] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!score) return;
    setSaving(true);
    setError(null);
    const res = await markTaken({ goalId, score, changed });
    setSaving(false);
    if (!res.ok) return setError(res.message);
    setSaved(true);
    window.scrollTo({ top: 0 });
  }

  const versus =
    score && aim && start && score > start
      ? score > aim ? `${stepsBetween(aim, score)} further than you thought.` : score === aim ? "Just as you thought." : null
      : null;

  if (saved && score) {
    return (
      <>
        <p className="ns-taken-result">
          {start ? <>From {start} to <b>{score}</b>.</> : <>Now <b>{score}</b>.</>} {versus ? <span>{versus.charAt(0).toUpperCase() + versus.slice(1)}</span> : null}
        </p>
        <p className="au-detail-k ns-moves-k">What&rsquo;s next?</p>
        <div className="ns-next">
          {areaId ? (
            <form action={openNextStep.bind(null, areaId)}>
              <button type="submit" className="ns-next-opt main"><b>Take the next one here</b><span>A new Next Step for {area}, from {score}.</span></button>
            </form>
          ) : null}
          <Link href="/next-step?choose=1" className="ns-next-opt"><b>Choose another area</b><span>See your chart and pick where to go next.</span></Link>
          <Link href="/next-step" className="ns-next-opt"><b>Let it settle for now</b><span>Keep what you&rsquo;ve built. Come back when you&rsquo;re ready.</span></Link>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="au-start-q ns-center">Where is {area} now?</p>
      <p className="au-start-help ns-center">
        Score it as it is today, not as you hope.{start ? ` You were at ${start}` : ""}{start && aim ? `, and thought it could take you to ${aim}` : ""}{start ? "." : ""}
      </p>
      <div className="ns-score-pick" role="group" aria-label={`Where is ${area} now?`}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" aria-pressed={score === n} className={n === start ? "was" : undefined} onClick={() => setScore(n)}>{n}</button>
        ))}
      </div>
      <label className="au-start-q" htmlFor="ns-changed">What changed?</label>
      <p className="au-start-help">In you and around you. This is the story you&rsquo;ll want to remember.</p>
      <textarea id="ns-changed" rows={3} value={changed} onChange={(e) => setChanged(e.target.value)} />
      <div className="ns-form-foot">
        <button type="button" className="btn btn-p" disabled={!score || saving} onClick={save}>{saving ? "Saving…" : "It’s taken"}</button>
        {error ? <span className="clear-err" role="alert">{error}</span> : null}
      </div>
    </>
  );
}
