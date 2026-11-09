"use client";

import { useState } from "react";
import { saveCalibration, shareCalibration, type Calibration } from "@/lib/actions/calibration";
import { progress, shift, type CalibratedArea } from "@/lib/calibration";

type Row = { id: string; name: string; alone: number | null; note: string | null };

// "Take your chart further", inside a coaching session: all ten areas, one by
// one. For each: the score they gave alone (and their note), what the scores
// mean for them in their words, the agreed score (the new baseline) and
// whether it's a focus area. Saved as you go; shared with the client when
// ready, like a summary. Their original audit is never changed.
export function ChartCalibration({
  sessionId,
  clientId,
  firstName,
  auditId,
  auditDate,
  rows,
  initial,
}: {
  sessionId: string;
  clientId: string;
  firstName: string;
  auditId: string;
  auditDate: string;
  rows: Row[];
  initial: Calibration | null;
}) {
  const start: CalibratedArea[] = rows.map((r) => {
    const saved = initial?.areas.find((a) => a.life_area_id === r.id);
    return saved ? { ...saved, alone: r.alone } : { life_area_id: r.id, alone: r.alone, agreed: null, definition: "", focus: false };
  });
  const [areas, setAreas] = useState(start);
  const [status, setStatus] = useState(initial?.status ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const done = progress(areas);

  const edit = (i: number, patch: Partial<CalibratedArea>) => {
    setAreas((list) => list.map((a, j) => (j === i ? { ...a, ...patch } : a)));
    setDirty(true);
    setNote(null);
  };

  async function save(): Promise<boolean> {
    setBusy("save");
    const r = await saveCalibration({ sessionId, clientId, auditId, areas });
    setBusy(null);
    if (!r.ok) {
      setNote({ ok: false, text: r.message });
      return false;
    }
    setDirty(false);
    setStatus((s) => s ?? "draft");
    setNote({ ok: true, text: "Saved." });
    return true;
  }

  async function share() {
    if (dirty && !(await save())) return;
    if (!window.confirm(`Share this chart with ${firstName}? They'll see the agreed scores, their definitions and the focus areas in My Journey.`)) return;
    setBusy("share");
    const r = await shareCalibration(sessionId, clientId);
    setBusy(null);
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setStatus("shared");
    setNote({ ok: true, text: `Shared with ${firstName}.` });
  }

  return (
    <div className="cal">
      <p className="admin-card-sub">
        From {firstName}&rsquo;s audit on {auditDate}. Agree what each score means for {firstName} first; the number follows from that.
        Their original scores stay as they are.
      </p>
      <ol className="cal-list">
        {rows.map((r, i) => {
          const a = areas[i];
          return (
            <li key={r.id} className={a.focus ? "is-focus" : undefined}>
              <div className="cal-head">
                <b>{r.name}</b>
                <span className="cal-alone">Alone: {r.alone ?? "—"}/10</span>
                {shift(a) ? <span className="cal-shift">{shift(a)}</span> : null}
              </div>
              {r.note ? <p className="cal-note">&ldquo;{r.note}&rdquo;</p> : null}
              <label className="cal-def">
                <span>What the scores mean for {firstName}</span>
                <textarea rows={2} maxLength={600} value={a.definition} placeholder="e.g. A 10 is… A 5 is…" onChange={(e) => edit(i, { definition: e.target.value })} />
              </label>
              <div className="cal-row">
                <label>
                  <span>Agreed score</span>
                  <select value={a.agreed ?? ""} onChange={(e) => edit(i, { agreed: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Not yet</option>
                    {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="cal-focus">
                  <input type="checkbox" checked={a.focus} onChange={(e) => edit(i, { focus: e.target.checked })} />
                  Focus area
                </label>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="cs-actions">
        <button type="button" className="btn btn-g" disabled={!dirty || busy !== null} onClick={save}>{busy === "save" ? "Saving…" : "Save chart"}</button>
        <button type="button" className="btn btn-p" disabled={busy !== null || done.agreed === 0} onClick={share}>
          {busy === "share" ? "Sharing…" : status === "shared" ? `Share the update with ${firstName}` : `Share with ${firstName}`}
        </button>
        <span className="admin-card-sub">
          {done.agreed} of {rows.length} agreed · {done.focus} focus · {status === "shared" ? "shared" : status === "draft" ? "not shared yet" : "not saved yet"}
        </span>
        {note ? <span className={note.ok ? "admin-ok" : "clear-err"} role="status">{note.text}</span> : dirty ? <span className="admin-card-sub">Unsaved changes</span> : null}
      </div>
    </div>
  );
}
