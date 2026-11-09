"use client";

import { useState } from "react";
import { answerProposal, discussReflection } from "@/lib/actions/summaries";
import type { DiscussTurn } from "@/lib/ai-discuss";

const TARGET_LABEL = { approach: "your approach", working_on: "what you're working on", client_context: "what you know about this client" } as const;

// "Discuss" under one point of the coaching reflection: push back, add
// context or ask what to do; the AI answers from the transcript. A proposed
// line for the profile or client context changes nothing until accepted.
export function ReflectionDiscussion({ transcriptId, pointKey, initial, aiAvailable }: { transcriptId: string; pointKey: string; initial: DiscussTurn[]; aiAvailable: boolean }) {
  const [thread, setThread] = useState(initial);
  const [open, setOpen] = useState(initial.length > 0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const r = await discussReflection(transcriptId, pointKey, text);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setThread(r.thread);
    setText("");
  }

  async function answer(index: number, accept: boolean, edited?: string) {
    setBusy(true);
    setError(null);
    const r = await answerProposal({ transcriptId, key: pointKey, index, accept, text: edited });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setThread(r.thread);
    setEditing(null);
  }

  if (!open) {
    return aiAvailable ? (
      <button type="button" className="au-text-link as-btn rf-discuss-open" onClick={() => setOpen(true)}>Discuss</button>
    ) : null;
  }

  return (
    <div className="rf-discuss">
      {thread.map((t, i) => (
        <div key={i} className={`rf-turn is-${t.role}`}>
          <span className="rf-turn-who">{t.role === "coach" ? "You" : "Reflection"}</span>
          <p>{t.text}</p>
          {t.proposal && t.proposal.target !== "none" ? (
            <div className="rf-proposal">
              <span className="rf-sub">Suggested for {TARGET_LABEL[t.proposal.target]}:</span>
              {editing?.index === i ? (
                <textarea rows={2} value={editing.text} onChange={(e) => setEditing({ index: i, text: e.target.value })} aria-label="Edit the suggestion" />
              ) : (
                <p className="rf-proposal-text">&ldquo;{t.proposal.text}&rdquo;</p>
              )}
              {t.proposal.status ? (
                <span className={t.proposal.status === "accepted" ? "admin-ok" : "rf-sub"}>{t.proposal.status === "accepted" ? "Added." : "Not added."}</span>
              ) : (
                <div className="rf-proposal-actions">
                  {editing?.index === i ? (
                    <button type="button" className="btn btn-g" disabled={busy || !editing.text.trim()} onClick={() => answer(i, true, editing.text)}>Add as edited</button>
                  ) : (
                    <>
                      <button type="button" className="btn btn-g" disabled={busy} onClick={() => answer(i, true)}>Add</button>
                      <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => setEditing({ index: i, text: t.proposal!.text })}>Edit</button>
                    </>
                  )}
                  <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => answer(i, false)}>No thanks</button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ))}
      {aiAvailable ? (
        <div className="rf-discuss-write">
          <label className="sr-only" htmlFor={`rf-${pointKey}`}>Your reply</label>
          <textarea id={`rf-${pointKey}`} rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={thread.length ? "Reply" : "Push back, add context, or ask what to try"} />
          <button type="button" className="btn btn-g" disabled={busy || !text.trim()} onClick={send}>{busy ? "Thinking…" : "Send"}</button>
        </div>
      ) : null}
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </div>
  );
}
