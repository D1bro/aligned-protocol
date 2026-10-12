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

  async function save() {
    setPending(true);
    setNote(null);
    const result = await saveToolEntry(toolSlug, answers);
    setPending(false);
    setNote(result.ok ? "Saved." : "Couldn’t save — try again.");
  }

  return (
    <div className="learn-reflect">
      {prompts.map((p) => (
        <div key={p.key}>
          <label htmlFor={`t-${p.key}`} className="au-start-q">{p.label}</label>
          <textarea
            id={`t-${p.key}`}
            rows={3}
            placeholder={p.placeholder || undefined}
            value={answers[p.key] ?? ""}
            onChange={(e) => setAnswers({ ...answers, [p.key]: e.target.value })}
          />
        </div>
      ))}
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
