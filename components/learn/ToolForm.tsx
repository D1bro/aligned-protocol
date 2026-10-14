"use client";

import { useState } from "react";
import Link from "next/link";
import { saveToolEntry } from "@/lib/actions/learn";
import type { Tool } from "@/lib/learn-content";

export function ToolForm({
  toolSlug,
  prompts,
  initial,
}: {
  toolSlug: string;
  prompts: Tool["prompts"];
  initial: Record<string, string>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const any = prompts.some((p) => answers[p.key]?.trim());
  const sectioned = prompts.some((p) => p.section);
  // Group prompts into the sections they start.
  const sections: { title?: string; intro?: string; optional?: boolean; prompts: Tool["prompts"] }[] = [];
  for (const p of prompts) {
    if (p.section || !sections.length) sections.push({ title: p.section, intro: p.sectionIntro, optional: p.optional, prompts: [] });
    sections[sections.length - 1].prompts.push(p);
  }
  const field = (p: Tool["prompts"][number]) => (
    <div key={p.key}>
      <label htmlFor={`t-${p.key}`} className={`au-start-q${sectioned ? " clear-q-sm" : ""}`}>{p.label}</label>
      {p.rows === 1 ? (
        <input
          id={`t-${p.key}`}
          type="text"
          placeholder={p.placeholder || undefined}
          value={answers[p.key] ?? ""}
          onChange={(e) => setAnswers({ ...answers, [p.key]: e.target.value })}
        />
      ) : (
        <textarea
          id={`t-${p.key}`}
          rows={p.rows ?? 3}
          placeholder={p.placeholder || undefined}
          value={answers[p.key] ?? ""}
          onChange={(e) => setAnswers({ ...answers, [p.key]: e.target.value })}
        />
      )}
    </div>
  );

  async function save() {
    setPending(true);
    setNote(null);
    const result = await saveToolEntry(toolSlug, answers);
    setPending(false);
    setNote(result.ok ? "Saved." : "Couldn’t save — try again.");
  }

  return (
    <div className="learn-reflect">
      {sections.map((sec, i) => {
        const body = (
          <>
            {sec.intro ? <p className="tool-section-intro">{sec.intro}</p> : null}
            {sec.prompts.map(field)}
          </>
        );
        if (!sec.title) return <div key={i}>{body}</div>;
        if (!sec.optional) {
          return (
            <div key={i}>
              <h2 className="tool-section">{sec.title}</h2>
              {body}
            </div>
          );
        }
        return (
          <details key={i} className="tool-optional" open={sec.prompts.some((p) => answers[p.key]?.trim())}>
            <summary>
              {sec.title} <span>Optional</span>
            </summary>
            {body}
          </details>
        );
      })}
      <div className="learn-actions">
        <button type="button" className="btn btn-p" disabled={!any || pending} onClick={save}>
          {pending ? "Saving…" : "Save my answers"}
        </button>
        <Link href="/clear" className="au-text-link">Open my plan</Link>
        <span className={`au-small${note?.startsWith("Couldn") ? " clear-err" : ""}`} aria-live="polite">{note}</span>
      </div>
    </div>
  );
}
