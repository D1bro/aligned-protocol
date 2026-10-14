"use client";

import { useState } from "react";
import { saveIdentityStatement } from "@/lib/actions/preferences";

// An optional line, in the member's own words, about who they're becoming.
// Never written or rewritten for them.
export function IdentityStatement({ initial }: { initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function save() {
    setPending(true);
    setError(false);
    const result = await saveIdentityStatement(text);
    setPending(false);
    if (!result.ok) return setError(true);
    setSaved(text.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="identity-edit">
        <label htmlFor="identity" className="au-detail-k">Who I&rsquo;m becoming, in my own words</label>
        <input
          id="identity"
          type="text"
          maxLength={280}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I am someone who…"
          autoFocus
        />
        <div className="identity-actions">
          <button type="button" className="btn btn-g" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</button>
          <button
            type="button"
            className="au-text-link as-btn"
            disabled={pending}
            onClick={() => {
              setText(saved);
              setEditing(false);
              setError(false);
            }}
          >
            Cancel
          </button>
          {error ? <span className="clear-err" role="alert">Couldn&rsquo;t save — try again.</span> : null}
        </div>
      </div>
    );
  }

  return saved ? (
    <div className="identity">
      <p>&ldquo;{saved}&rdquo;</p>
      <button type="button" className="au-text-link as-btn" onClick={() => setEditing(true)}>Edit</button>
    </div>
  ) : (
    <button type="button" className="identity-add" onClick={() => setEditing(true)}>
      + Add a line about who you&rsquo;re becoming <span>Optional, in your own words</span>
    </button>
  );
}
