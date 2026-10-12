"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveStartingPoint } from "@/lib/actions/clear";

export type StartArea = { id: string; name: string; score: number; note: string | null };

// The "aha" at the top of the snapshot: the area asking for the most
// attention, the person's own words about it, and one reflective question
// pitched one point above their score. Saving it is what creates (or, for a
// signed-in person, starts) their profile's first piece of work.
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
  const question = chosen.score >= 10 ? "What would keep this at a 10?" : `What would a ${target} look like?`;

  async function submit() {
    setPending(true);
    setError(null);
    const result = await saveStartingPoint({ auditId, lifeAreaId: chosen.id, target, answer });
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    router.push(isGuest ? "/login?signup=1" : "/clear");
  }

  return (
    <div className="au-start">
      <div className="eyebrow"><span className="eydot" /> Your starting point</div>

      {isLowest && lowest.length > 1 && !picking ? (
        <>
          <h2 className="au-start-h">
            {lowest.length === 2 ? "Two areas are" : `${lowest.length} areas are`} asking for the most attention.
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
          <h2 className="au-start-h">{chosen.name} is asking for the most attention.</h2>
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

      <label className="au-start-q" htmlFor="step-up">{question}</label>
      <p className="au-start-help">
        {chosen.score >= 10
          ? "What’s working here that you want to protect?"
          : "What would it feel like if this area started to improve? Not a complete fix — one honest step up."}
      </p>
      <textarea
        id="step-up"
        rows={3}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={chosen.score >= 10 ? "What keeps it here…" : `A ${target} would mean…`}
      />

      <div className="au-start-actions">
        <button type="button" className="btn btn-p" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : isGuest ? "Save my starting point" : `Start with ${chosen.name} →`}
        </button>
        <button type="button" className="au-text-link as-btn" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
          {picking ? "Keep this area" : "I’d rather start somewhere else"}
        </button>
      </div>
      {isGuest ? (
        <p className="au-start-note">
          Creates a free account that keeps your snapshot, your notes and this starting point together on your profile.
        </p>
      ) : null}
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
