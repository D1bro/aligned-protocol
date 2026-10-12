"use client";

import { useState } from "react";
import Link from "next/link";
import { saveLesson } from "@/lib/actions/learn";

// The lesson's reflection (private to them, and their coach) and "mark complete".
export function LessonForm({
  lessonSlug,
  question,
  initialReflection,
  completed,
  nextHref,
  nextLabel,
}: {
  lessonSlug: string;
  question: string;
  initialReflection: string;
  completed: boolean;
  nextHref: string;
  nextLabel: string;
}) {
  const [text, setText] = useState(initialReflection);
  const [done, setDone] = useState(completed);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save(complete: boolean) {
    setPending(true);
    setNote(null);
    const result = await saveLesson(lessonSlug, text, complete);
    setPending(false);
    if (!result.ok) return setNote(result.message ?? "Couldn’t save — try again.");
    if (complete) setDone(true);
    setNote(complete ? "Lesson complete." : "Saved.");
  }

  return (
    <section className="learn-reflect" aria-labelledby="reflect-h">
      <label id="reflect-h" htmlFor="reflect" className="au-start-q">{question}</label>
      <p className="au-start-help">Just for you — only you and your coach can see it.</p>
      <textarea id="reflect" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="learn-actions">
        {done ? (
          <>
            <button type="button" className="btn btn-g" disabled={pending} onClick={() => save(false)}>
              {pending ? "Saving…" : "Save my reflection"}
            </button>
            <Link href={nextHref} className="btn btn-p">{nextLabel}</Link>
          </>
        ) : (
          <button type="button" className="btn btn-p" disabled={pending} onClick={() => save(true)}>
            {pending ? "Saving…" : "Save and mark complete"}
          </button>
        )}
        <span className={`au-small${note && note.startsWith("Couldn") ? " clear-err" : ""}`} aria-live="polite">
          {done && !note ? "Completed" : note}
        </span>
      </div>
    </section>
  );
}
