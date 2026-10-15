"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePrepDraft, sharePrep } from "@/lib/actions/member-coaching";

// "Before we meet": private until they choose to share it.
export function PrepEditor({
  sessionId,
  initial,
  lastShared,
}: {
  sessionId: string | null;
  initial: string;
  lastShared: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState<null | "save" | "share">(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy("save");
    setNote(null);
    const r = await savePrepDraft({ sessionId, content: text });
    setBusy(null);
    if (!r.ok) return setNote({ ok: false, text: r.message ?? "Couldn’t save." });
    setSaved(text);
    setNote({ ok: true, text: "Saved privately. Your coach can't see it until you share it." });
  }
  async function share() {
    if (!window.confirm("Share this with your coach?")) return;
    setBusy("share");
    setNote(null);
    const r = await sharePrep({ sessionId, content: text });
    setBusy(null);
    if (!r.ok) return setNote({ ok: false, text: r.message ?? "Couldn’t share." });
    setSaved(text);
    setNote({ ok: true, text: "Shared with your coach." });
    router.refresh();
  }

  return (
    <div className="mc-prep">
      <textarea
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setNote(null);
        }}
        placeholder="What's happened since we last spoke? What would make our next session useful?"
        aria-label="Your preparation"
      />
      <div className="cs-actions">
        <button type="button" className="btn btn-g" disabled={busy !== null || text === saved} onClick={save}>
          {busy === "save" ? "Saving…" : "Save privately"}
        </button>
        <button type="button" className="btn btn-o" disabled={busy !== null || !text.trim()} onClick={share}>
          {busy === "share" ? "Sharing…" : "Share with my coach"}
        </button>
        <span className={note && !note.ok ? "clear-err" : "note-status"} aria-live="polite">
          {note ? note.text : text !== saved ? "Not saved yet" : lastShared ? `Last shared ${lastShared}` : "Private — not shared"}
        </span>
      </div>
    </div>
  );
}
