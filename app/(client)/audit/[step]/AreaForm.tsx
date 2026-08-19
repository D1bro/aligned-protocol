"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveResponse } from "@/lib/actions/audit";
import type { LifeArea } from "@/lib/actions/audit";

const SATISFACTION_SCALE = Array.from({ length: 10 }, (_, i) => i + 1);
const IMPORTANCE_SCALE = Array.from({ length: 5 }, (_, i) => i + 1);

export function AreaForm({
  auditId,
  area,
  step,
  totalSteps,
  initialSatisfaction,
  initialImportance,
  initialNote,
}: {
  auditId: string;
  area: LifeArea;
  step: number;
  totalSteps: number;
  initialSatisfaction: number | null;
  initialImportance: number | null;
  initialNote: string;
}) {
  const router = useRouter();
  const [satisfaction, setSatisfaction] = useState<number | null>(initialSatisfaction);
  const [importance, setImportance] = useState<number | null>(initialImportance);
  const [note, setNote] = useState(initialNote);
  const [pending, startTransition] = useTransition();

  const canContinue = satisfaction !== null && importance !== null;
  const pct = Math.round((step / totalSteps) * 100);

  function persistAndGo(nextStep: number | "leverage") {
    if (satisfaction === null || importance === null) return;
    startTransition(async () => {
      await saveResponse({ auditId, lifeAreaId: area.id, satisfaction, importance, note });
      router.push(nextStep === "leverage" ? "/audit/leverage" : `/audit/${nextStep}`);
    });
  }

  return (
    <>
      <div className="topbar">
        {step > 1 ? (
          <button className="tb-back" onClick={() => persistAndGo(step - 1)} disabled={pending}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        <span className="tb-label">Area {step} of {totalSteps}</span>
      </div>
      <div className="progbar"><div className="progfill" style={{ width: `${pct}%` }} /></div>

      <div className="page">
        <div className="area-icon" style={{ width: 44, height: 44, fontSize: 18, marginBottom: "1rem" }}>{area.icon}</div>
        <h1>{area.name}</h1>
        <p className="lead">{area.description}</p>
        {area.hint ? <p className="body-t" style={{ marginTop: "-.75rem", marginBottom: "1.25rem" }}>{area.hint}</p> : null}

        <div className="qbox">
          <div className="qlabel">How is this area right now?</div>
          <div className="score-grid">
            {SATISFACTION_SCALE.map((n) => (
              <button
                key={n}
                type="button"
                className={`sbn ${satisfaction === n ? "picked" : ""}`}
                onClick={() => setSatisfaction(n)}
                aria-pressed={satisfaction === n}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="score-range"><span>Deeply out of alignment</span><span>Fully aligned</span></div>
        </div>

        <div className="qbox">
          <div className="qlabel">How much does this area matter to you?</div>
          <div>
            {IMPORTANCE_SCALE.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip ${importance === n ? "picked" : ""}`}
                onClick={() => setImportance(n)}
                aria-pressed={importance === n}
                style={{ minWidth: "3.5rem", justifyContent: "center", fontSize: "15px", padding: "10px 0" }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="score-range"><span>Not important right now</span><span>Extremely important</span></div>
        </div>

        <label className="lbl" htmlFor="note">Add more detail (optional)</label>
        <textarea
          id="note"
          rows={3}
          placeholder="Anything you want to note about this area…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="foot-nav">
        <span className="tb-label">{canContinue ? "Saved automatically" : "Rate both to continue"}</span>
        <button
          className="btn btn-p"
          disabled={!canContinue || pending}
          onClick={() => persistAndGo(step === totalSteps ? "leverage" : step + 1)}
        >
          {pending ? "Saving…" : step === totalSteps ? "Continue to focus question" : "Continue"}
        </button>
      </div>
    </>
  );
}
