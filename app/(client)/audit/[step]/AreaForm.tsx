"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveResponse, completeAudit } from "@/lib/actions/audit";
import type { LifeArea } from "@/lib/actions/audit";
import type { AreaGuide } from "@/lib/audit-guides";
import { GuideVideo } from "@/components/audit/GuideVideo";

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1);

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

export function AreaForm({
  auditId,
  area,
  step,
  totalSteps,
  guide,
  initialSatisfaction,
  initialNote,
}: {
  auditId: string;
  area: LifeArea;
  step: number;
  totalSteps: number;
  guide: AreaGuide | undefined;
  initialSatisfaction: number | null;
  initialNote: string;
}) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(initialSatisfaction);
  const [note, setNote] = useState(initialNote);
  // What the database currently holds for this area. "Saved" is only ever
  // shown when the on-screen answer matches this.
  const [saved, setSaved] = useState({ score: initialSatisfaction, note: initialNote });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [navigating, setNavigating] = useState(false);
  // Saves run one after another so a slow earlier save can't overwrite a later one.
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));

  const dirty = score !== saved.score || note !== saved.note;
  const isLast = step === totalSteps;

  // Guest safety (Duane, 11 Nov 2026): what's on screen is kept in this
  // browser until it's saved, so a refresh, a closed tab or a dropped
  // connection doesn't lose a score or a note.
  const draftKey = `aligned:audit-draft:${auditId}:${area.id}`;
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    let draft: { score: number | null; note: string } | null = null;
    try {
      draft = JSON.parse(window.localStorage.getItem(draftKey) ?? "null");
    } catch {}
    if (!draft || (draft.score === initialSatisfaction && draft.note === initialNote)) return;
    const nextScore = draft.score ?? initialSatisfaction;
    const nextNote = typeof draft.note === "string" ? draft.note : initialNote;
    setScore(nextScore);
    setNote(nextNote);
    void save(nextScore, nextNote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (dirty) window.localStorage.setItem(draftKey, JSON.stringify({ score, note }));
      else window.localStorage.removeItem(draftKey);
    } catch {}
  }, [dirty, score, note, draftKey]);

  // Save the note a moment after they stop typing, not only when they leave the box.
  useEffect(() => {
    if (!dirty || score === null || note === saved.note) return;
    const t = window.setTimeout(() => void save(score, note), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  // Leaving with something unsaved: the browser asks first.
  useEffect(() => {
    if (!dirty && status.kind !== "saving") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, status.kind]);

  function save(nextScore: number | null, nextNote: string): Promise<boolean> {
    if (nextScore === null) return Promise.resolve(true); // nothing to save until there's a score
    const run = queue.current.then(async () => {
      setStatus({ kind: "saving" });
      const result = await saveResponse({ auditId, lifeAreaId: area.id, satisfaction: nextScore, note: nextNote });
      if (!result.ok) {
        setStatus({ kind: "error", message: "Save failed. Your answer is kept on this device." });
        return false;
      }
      setSaved({ score: nextScore, note: nextNote });
      setStatus({ kind: "idle" });
      return true;
    });
    queue.current = run.catch(() => false);
    return run.catch(() => {
      setStatus({ kind: "error", message: "Save failed. Check your connection: your answer is kept on this device." });
      return false;
    });
  }

  function pickScore(n: number) {
    setScore(n);
    void save(n, note);
  }

  async function go(href: string) {
    setNavigating(true);
    const ok = dirty ? await save(score, note) : true;
    if (ok) router.push(href);
    else setNavigating(false);
  }

  // Last area: save, mark the audit complete and go straight to the snapshot.
  async function finish() {
    setNavigating(true);
    const ok = dirty ? await save(score, note) : true;
    if (!ok) return setNavigating(false);
    const result = await completeAudit(auditId); // redirects to /audit/results on success
    if (result && !result.ok) {
      setStatus({ kind: "error", message: result.message });
      setNavigating(false);
    }
  }

  let statusText: string;
  if (status.kind === "saving") statusText = "Saving…";
  else if (status.kind === "error") statusText = status.message;
  else if (score === null) statusText = note.trim() ? "Choose a score to save this area" : "Choose a score to continue";
  else if (dirty) statusText = `${score}/10 selected`;
  else statusText = "Saved";

  const backHref = step > 1 ? `/audit/${step - 1}` : "/audit?intro=1";


  return (
    <>
      <div className="topbar">
        <button type="button" className="tb-back" onClick={() => go(backHref)} disabled={navigating}>
          ← Back
        </button>
        <span className="tb-label">Area {step} of {totalSteps}</span>
      </div>
      <div className="au-progress" role="progressbar" aria-label="Audit progress" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <span key={i} className={i < step ? "on" : undefined} />
        ))}
      </div>

      <div className="page au-page">
        <div className="au-title">
          <span className="au-num">{String(step).padStart(2, "0")}</span>
          <h1>{area.name}</h1>
        </div>

        <div className="au-qgrid">
          <div className="au-guide">
            <p className="au-desc">{area.description}</p>
            {area.hint ? <p className="au-hint">{area.hint}</p> : null}
            {guide ? <GuideVideo clip={guide} caption={guide.prompt} /> : null}
          </div>

          <section className="au-answer" aria-labelledby="au-q">
            <h2 id="au-q">How is this area right now?</h2>
            <p className="au-small">One honest score, based on how things actually feel right now.</p>

            <div className="au-scores" role="group" aria-label="Alignment score from 1 to 10">
              {SCALE.map((n) => (
                <button
                  key={n}
                  type="button"
                  data-score={n}
                  aria-pressed={score === n}
                  aria-label={`${n} out of 10`}
                  onClick={() => pickScore(n)}
                  disabled={navigating}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="au-range" aria-hidden="true">
              <span className="lo">1 · Completely out of alignment</span>
              <span className="hi">10 · Fully aligned</span>
            </div>

            <label className="au-note-label" htmlFor="note">
              Add more detail <span>Optional</span>
            </label>
            <textarea
              id="note"
              rows={4}
              placeholder="What’s working? What feels difficult?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (dirty) void save(score, note);
              }}
            />

            <div className="au-actions">
              <span className={`au-status${status.kind === "error" ? " err" : ""}`} aria-live="polite">
                {statusText}
                {status.kind === "error" && score !== null ? (
                  <button type="button" className="au-text-link as-btn au-retry" onClick={() => void save(score, note)}>Try again</button>
                ) : null}
              </span>
              <button type="button" className="btn btn-p" disabled={score === null || navigating} onClick={() => (isLast ? finish() : go(`/audit/${step + 1}`))}>
                {navigating ? "Saving…" : isLast ? "See my snapshot →" : "Continue →"}
              </button>
            </div>
          </section>
        </div>
        <p className="au-foot">Your notes give you something useful to come back to.</p>
      </div>
    </>
  );
}
