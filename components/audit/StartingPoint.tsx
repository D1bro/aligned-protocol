"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveStartingPoint } from "@/lib/actions/clear";

export type StartArea = { id: string; name: string; score: number; note: string | null };

// The "aha" at the top of the snapshot: the area asking for the most
// attention, the person's own words about it, and screen 1 of The Next Step:
// what's actually going on in this area right now? Saving it leads straight
// into the other four screens (no account needed until it's set).
export function StartingPoint({
  auditId,
  areas,
  chosenId,
  onChoose,
  initialAnswer,
  isGuest,
}: {
  auditId: string;
  areas: StartArea[];
  chosenId: string;
  onChoose: (areaId: string) => void;
  initialAnswer: string;
  isGuest: boolean;
}) {
  const router = useRouter();
  const lowestScore = Math.min(...areas.map((a) => a.score));
  const lowest = areas.filter((a) => a.score === lowestScore);
  const [answer, setAnswer] = useState(initialAnswer);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = areas.find((a) => a.id === chosenId)!;
  const isLowest = chosen.score === lowestScore;
  const target = Math.min(10, chosen.score + 1);

  async function submit() {
    setPending(true);
    setError(null);
    const result = await saveStartingPoint({ auditId, lifeAreaId: chosen.id, target, answer, field: "current_reality" });
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    router.push(`/next-step/build?plan=${result.planId}&step=2`);
  }

  return (
    <div className="au-start">
      <div className="eyebrow"><span className="eydot" /> The Next Step · 1 of 5 · where you are</div>
      <p className="au-start-sub">You&rsquo;ve seen the wider picture. Now find the one step that gets you unstuck in one area.</p>

      {isLowest && lowest.length > 1 && !picking ? (
        <>
          <h2 className="au-start-h">
            {lowest.length === 2 ? "Two areas are" : `${lowest.length} areas are`} asking for <em>the most attention.</em>
          </h2>
          <p className="au-start-sub">Both scored {lowestScore} out of 10, your lowest. Which feels like the place to start?</p>
          <div className="au-chips" role="group" aria-label="Choose your starting area">
            {lowest.map((a) => (
              <button key={a.id} type="button" aria-pressed={a.id === chosenId} onClick={() => onChoose(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
        </>
      ) : isLowest ? (
        <>
          <h2 className="au-start-h">{chosen.name} is asking for <em>the most attention.</em></h2>
          <p className="au-start-sub">You scored it {chosen.score} out of 10, your lowest.</p>
        </>
      ) : (
        <>
          <h2 className="au-start-h">You&rsquo;ve chosen to start with {chosen.name}.</h2>
          <p className="au-start-sub">
            You scored it {chosen.score} out of 10. Your lowest was {lowest[0].name} at {lowestScore} — it&rsquo;s worth
            noticing why this one feels like the place to start.
          </p>
        </>
      )}

      {chosen.note ? (
        <blockquote className="au-quote">
          <p>&ldquo;{chosen.note}&rdquo;</p>
          <cite>What you wrote about {chosen.name}</cite>
        </blockquote>
      ) : null}

      <label className="au-start-q" htmlFor="step-up">What&rsquo;s actually going on in this area right now?</label>
      <p className="au-start-help">In your own words. As much or as little as you like. Only you, and your coach if you have one, can see this.</p>
      <textarea id="step-up" rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="In your own words…" />

      <div className="au-start-actions">
        <button type="button" className="btn btn-p" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Find my Next Step →"}
        </button>
        <button type="button" className="au-text-link as-btn" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
          {picking ? "Keep this area" : "I’d rather start somewhere else"}
        </button>
      </div>
      <p className="au-start-note">
        Four more short screens, about ten minutes.{isGuest ? " No account needed until your Next Step is set." : ""}
      </p>
      {error ? <p className="au-status err" role="alert">{error}</p> : null}

      {picking ? (
        <div className="au-chips wrap" role="group" aria-label="Choose a different starting area">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={a.id === chosenId}
              onClick={() => {
                onChoose(a.id);
                setPicking(false);
              }}
            >
              {a.name} <span>{a.score}/10</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
