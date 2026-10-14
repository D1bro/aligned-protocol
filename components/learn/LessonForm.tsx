"use client";

import { useState } from "react";
import Link from "next/link";
import { saveLesson } from "@/lib/actions/learn";

// The lesson's reflection and "mark complete". A reflection is shared with
// the member's coach unless they tick "keep private". Completing a lesson is
// separate from completing a goal.
export function LessonForm({
  lessonSlug,
  question,
  initialReflection,
  initialPrivate,
  hasCoach,
  completed,
  nextHref,
  nextLabel,
}: {
  lessonSlug: string;
  question: string;
  initialReflection: string;
  initialPrivate: boolean;
  hasCoach: boolean;
  completed: boolean;
  nextHref: string;
  nextLabel: string;
}) {
  const [text, setText] = useState(initialReflection);
  const [keepPrivate, setKeepPrivate] = useState(initialPrivate);
  const [done, setDone] = useState(completed);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save(complete: boolean) {
    setPending(true);
    setNote(null);
    const result = await saveLesson(lessonSlug, text, complete, keepPrivate);
    setPending(false);
    if (!result.ok) return setNote(result.message ?? "Couldn’t save — try again.");
    if (complete) setDone(true);
    setNote(complete ? "Lesson complete." : "Saved.");
  }

  return (
    <section className="learn-reflect" aria-labelledby="reflect-h">
      <label id="reflect-h" htmlFor="reflect" className="au-start-q">{question}</label>
      <p className="au-start-help">
        {hasCoach
          ? keepPrivate
            ? "Private: only you can see this reflection."
            : "Shared with your coach, so you can talk it through together."
          : "Only you can see this. If you work with a coach, reflections are shared with them unless you keep them private."}{" "}
        Completing a lesson doesn&rsquo;t change your goal.
      </p>
      <textarea id="reflect" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      <label className="learn-private">
        <input type="checkbox" checked={keepPrivate} onChange={(e) => setKeepPrivate(e.target.checked)} />
        Keep this reflection private{hasCoach ? " (don’t share with my coach)" : ""}
      </label>
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
